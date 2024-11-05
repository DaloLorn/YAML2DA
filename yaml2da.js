import { argv as args } from 'process';
import { parse, stringify } from 'yaml';
import help from './function/help.js';
import packTo2DA from './function/pack.js';
import unpackFrom2DA from './function/unpack.js';

if(args.length < 3) {
    help();
}
else if(args.length < 4) {
    // ... We don't have any other no-args commands yet, so show help again anyway?
    // if(args[2].toLowerCase() === 'help')
        help();
} 
else {
    switch(args[2].toLowerCase()) {
        case 'convert':
        case 'build':
        case 'finalize':
        case 'pack':
        case 'to2da': 
        case 'export':
            await packTo2DA(args.slice(3));
            break;
        case 'help':
            console.info("Silly user, help doesn't take any parameters! Here you go, though:\n");
            help();
            break;
        case 'prepare':
        case 'unpack':
        case 'import':
        case 'from2da':
            await unpackFrom2DA(args.slice(3));
    }
}