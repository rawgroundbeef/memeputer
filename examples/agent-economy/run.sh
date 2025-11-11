#!/bin/bash
# Quick run script for agent economy
pnpm start run --task "$1" --budget "${2:-1.0}"

