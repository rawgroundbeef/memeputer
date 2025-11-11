# Changesets

This directory contains changeset files that describe changes to packages in this monorepo.

## How to use

1. When making changes, run `pnpm changeset` to create a changeset file
2. The changeset will ask which packages changed and what type of change (major/minor/patch)
3. Commit the changeset file along with your changes
4. When ready to release, merge changesets will create a PR with version bumps
5. Merging that PR will publish packages to npm

For more information, see the [Changesets documentation](https://github.com/changesets/changesets).

