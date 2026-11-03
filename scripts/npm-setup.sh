#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# © 2026 Hannes Stauss (scalarion@nimblescape.com)
# Licensed under the MIT License. See LICENSE in the repository root for details.

# The npmjs.com setup of the npm packages of the workspaces (CONTRIBUTING.md, "npmjs.com setup"): the GitHub
# environment `npm` with its deployment rules, the first version of each package, and the trusted publisher of each
# package, which lets the job publish-npm of the release workflow publish without a token. npmjs.com sets up a trusted
# publisher only for a package that exists, so the first version of each package is published once by hand, from the
# GitHub release of that version, in the order in which the packages need each other. Run it in the clone, on a
# computer where the GitHub CLI (`gh`) and npm 11.15.0 or newer are signed in, with an npm account that may publish in
# the organization nimblescape and has two-factor authentication:
#
#   gh auth login
#   npm login
#   scripts/npm-setup.sh            before the first release: the environment only
#   scripts/npm-setup.sh 0.2.0      after the release 0.2.0: the npm packages that npmjs.com does not hold yet, and
#                                   the trusted publishers
#
# After the second call, re-run the failed job "Publish to npmjs.com" of the release run: it finds the versions on
# npmjs.com and ends without a change. The script shows what it sets up and asks before it changes anything. It
# changes nothing that already exists, so it can run again; for each package, it shows the trusted publishers and asks
# whether to add the trusted publisher, because npm lists them only after the second factor, in the terminal.
set -euo pipefail

for tool in gh git node npm; do
  command -v "$tool" >/dev/null || { echo "$tool is not installed." >&2; exit 1; }
done

version="${1:-}"
version="${version#v}"
if [ -n "$version" ] && ! [[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "The version $1 does not have the form <major>.<minor>.<patch>." >&2
  exit 1
fi

# npm trust needs npm 11.15.0 or newer.
node -e '
  const [major, minor] = process.argv[1].split(".").map(Number);
  if (major < 11 || (major === 11 && minor < 15)) {
    console.error(`npm ${process.argv[1]} has no npm trust; install npm 11.15.0 or newer: npm install --global npm@11`);
    process.exit(1);
  }
' "$(npm --version)"

# owner/repository from the URL of `origin`: https://github.com/<owner>/<repository>(.git) or
# git@github.com:<owner>/<repository>(.git).
url=$(git -C "$(dirname "$0")" remote get-url origin)
repo="${url#*github.com[:/]}"
repo="${repo%/}"
repo="${repo%.git}"
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "The remote origin ($url) is no GitHub repository." >&2; exit 1; }
# The current name of the repository: the URL of `origin` of an older clone names
# the repository before a rename, and GitHub only forwards it.
repo=$(gh repo view "$repo" --json nameWithOwner --jq .nameWithOwner)
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
environment="npm"
workflow="release.yml"
account=$(npm whoami 2>/dev/null) || { echo "npm is not signed in: run npm login." >&2; exit 1; }

# The packages of the workspaces, each after the packages of the workspaces that it needs, as the release publishes them.
read -r -a packages <<< "$(node -e '
  const path = require("node:path");
  const root = process.argv[1];
  const folders = require(path.join(root, "package.json")).workspaces;
  const manifests = new Map(folders.map((folder) => [folder, require(path.join(root, folder, "package.json"))]));
  const names = new Map([...manifests].map(([folder, manifest]) => [manifest.name, folder]));
  const done = new Set();
  const order = [];
  const visit = (folder) => {
    if (done.has(folder)) return;
    done.add(folder);
    const manifest = manifests.get(folder);
    for (const kind of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      for (const name of Object.keys(manifest[kind] ?? {})) {
        if (names.has(name)) visit(names.get(name));
      }
    }
    order.push(manifest.name);
  };
  folders.forEach(visit);
  console.log(order.join(" "));
' "$root")"

missing=()
for package in "${packages[@]}"; do
  npm view "$package" name >/dev/null 2>&1 || missing+=("$package")
done
if [ "${#missing[@]}" = 0 ]; then
  first="none, npmjs.com holds every package"
elif [ -z "$version" ]; then
  first="none yet: run the script again with the version of the first release"
else
  first="$version of ${missing[*]}, from the GitHub release v$version"
fi

cat <<TEXT
Packages:           ${packages[*]}
Repository:         $repo
npm account:        $account
Environment:        $environment (tags v*, branch main)
First versions:     $first
Trusted publishers: GitHub Actions, $repo, workflow $workflow, environment $environment
TEXT
read -r -p "Set up the npm publishing of these packages? [y/N] " answer || true
[[ "$answer" =~ ^[Yy]$ ]] || { echo "Nothing changed."; exit 1; }

# The environment, which only the tags v* and the branch main reach.
gh api --method PUT "repos/$repo/environments/$environment" --input - >/dev/null <<JSON
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
existing=$(gh api "repos/$repo/environments/$environment/deployment-branch-policies" --jq '[.branch_policies[] | "\(.type):\(.name)"] | join(" ")')
for rule in "tag:v*" "branch:main"; do
  case " $existing " in
    *" $rule "*) echo "Deployment rule exists: $rule" ;;
    *)
      gh api --method POST "repos/$repo/environments/$environment/deployment-branch-policies" \
        -f type="${rule%%:*}" -f name="${rule#*:}" >/dev/null
      echo "Deployment rule added: $rule" ;;
  esac
done

if [ "${#missing[@]}" != 0 ]; then
  if [ -z "$version" ]; then
    echo "Done for now. After the first release, run: scripts/npm-setup.sh <version>"
    exit 0
  fi
  folder=$(mktemp -d)
  trap 'rm -rf "$folder"' EXIT
  for package in "${missing[@]}"; do
    # The tarball that CI built and the release holds, as npm pack names it: @scope/name gives scope-name-<version>.tgz.
    tarball="$(echo "${package#@}" | tr / -)-$version.tgz"
    gh release download "v$version" --repo "$repo" --pattern "$tarball" --dir "$folder"
    # npm asks for the second factor of the account.
    npm publish "$folder/$tarball" --access public
    echo "Published: $package $version"
  done
fi

# npm asks for the second factor of a trust command only in a terminal: when the script read the list through a
# pipe, npm would end with the error EOTP instead. So the list goes to the terminal, and you decide.
for package in "${packages[@]}"; do
  echo "Trusted publishers of $package on npmjs.com:"
  npm trust list "$package"
  read -r -p "Add the trusted publisher GitHub Actions, $repo, workflow $workflow, environment $environment to $package? Answer N when the list above shows it. [y/N] " answer || true
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    npm trust github "$package" --file "$workflow" --repository "$repo" --environment "$environment" --allow-publish --yes
    echo "Trusted publisher added to $package: $repo, $workflow, $environment"
  else
    echo "Trusted publisher of $package unchanged."
  fi
done

echo "Done. Re-run the failed job \"Publish to npmjs.com\" of the release run, if there is one."
