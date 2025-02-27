import { isString } from 'lodash-es';
import packTo2DA from './function/pack.js';
import unpackFrom2DA from './function/unpack.js';
import { getopt } from 'stdio';
import mergeFiles from './function/merge.js';

const options = getopt({
    import: {
        key: "i", description: "Tells YAML2DA to import data from 2DAs instead of exporting from YAML.",
    },
    merge: {
        key: "m", description: "Tells YAML2DA to merge a number of other YAML files into the target file's 'variants' field. Supersedes --import. Requires a valid schema for the target's yamlType unless the --unsafe flag is enabled.", args: "*"
    },
    outputFolder: {
        key: "o", description: "Specifies an output folder. Defaults to '{projectFolder}/packed' in export mode, or '{projectFolder}/unpacked' in import mode.", args: 1
    },
    filterType: {
        key: "f", description: "Only import/export files of the specified type(s), e.g. cls_feat, race_feat, classes. Exports check the yamlType field, imports test the 2DA schema. Ignored when exporting single files, and single-file imports instead use it to coerce the 2DA to a specific type.", args: "*"
    },
    schema: {
        key: "s", description: "Path to additional schema files to be loaded after defaultSchemas.yml. Exports also automatically load all files in the project folder with a yamlType of 'schema'. Note that 'defaultSchemas' is a reserved name and will not be loaded.", args: "*"
    },
    labelInvert: {
        key: "l", description: "When importing single-file 2DAs, puts the row ID ahead of the row label (if the schema specified a 'labelField') when naming the imported YMLs, ensuring the filenames are ordered by row ID. Normally, the label goes first, so the files are ordered alphabetically by row label."
    },
    printNulls: {
        key: "p", description: "When importing 2DAs, null values will no longer be stripped out of the resulting YMLs."
    },
    unsafe: {
        key: "u", description: "When running in merge mode, tells YAML2DA to ignore missing schemas and assume the target file is safe to merge into."
    },
    _meta_: { args: 1 },
})

let { filterType, schema, merge } = options;

let abort = false;

function exit(explanation) {
    console.error(explanation);
    abort = true;
}

// Numbers and booleans don't have lengths, and will thus throw errors.
// Everything else will coerce to either a string or an array of strings,
// though for ease of access filterType will always coerce to an array.
if(filterType) 
    if(!filterType?.length)
        exit("Must specify at least one parameter for --filterType!");
    else options.filterType = isString(filterType) ? [filterType] : filterType.filter(isString);
if(schema) 
    if(!schema?.length)
        exit("Must specify at least one parameter for --schema!");
    else options.schema = isString(schema) ? schema : schema.filter(isString);
if(merge) 
    if(!merge?.length)
        exit("Must specify at least one parameter for --merge!");
    else options.merge = isString(merge) ? merge : merge.filter(isString);

if(!abort) {
    if(options.merge) {
        await mergeFiles(options)
    }
    else if(options.import) {
        await unpackFrom2DA(options)
    }
    else {
        await packTo2DA(options)
    }
}