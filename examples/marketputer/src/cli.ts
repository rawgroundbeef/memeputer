#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { createRunCommand } from './commands/run';

const program = new Command();

program
  .name('marketputer')
  .description('Your autonomous marketing assistant that creates meme-ready posts in your brand\'s style')
  .version('0.1.0');

// Register commands
program.addCommand(createRunCommand());

program.parse();

