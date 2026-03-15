#!/usr/bin/env node

// Node 14 compatibility shim for Hardhat CLI analytics path.
if (typeof global.AbortController === 'undefined') {
  global.AbortController = require('abort-controller');
}

// Prevent telemetry codepaths from running when possible.
process.env.HARDHAT_DISABLE_TELEMETRY = process.env.HARDHAT_DISABLE_TELEMETRY || 'true';
process.env.DO_NOT_TRACK = process.env.DO_NOT_TRACK || '1';
process.env.CI = process.env.CI || 'true';

require('hardhat/internal/cli/cli');
