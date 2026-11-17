import {readdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';
for(const f of readdirSync('.').filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',f]);console.log('All source JavaScript parses.');
