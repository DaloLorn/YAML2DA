import packTo2DA from './function/pack.js';
import unpackFrom2DA from './function/unpack.js';
import { getopt } from 'stdio';

const options = getopt({
    import: {
        key: "i", description: "Tells YAML2DA to import data from 2DAs instead of exporting from YAML.",
    },
    outputFolder: {
        key: "o", description: "Specifies an output folder. Defaults to '{projectFolder}/packed' in export mode, or '{projectFolder}/unpacked' in import mode.", args: 1
    },
    filterType: {
        key: "f", description: "Only import/export files of the specified type(s), e.g. cls_feat, race_feat, classes. Exports check the yamlType field, imports test the 2DA schema. Ignored when exporting single files, and single-file imports instead use it to coerce the 2DA to a specific type.", args: "*", default: []
    },
    schema: {
        key: "s", description: "Path to additional schema files to be loaded after defaultSchemas.yml. Exports also automatically load all files in the project folder with a yamlType of 'schema'. Note that 'defaultSchemas' is a reserved name and will not be loaded.", args: "*", default: []
    },
    labelInvert: {
        key: "l", description: "When importing single-file 2DAs, puts the row ID ahead of the row label (if the schema specified a 'labelField') when naming the imported YMLs, ensuring the filenames are ordered by row ID. Normally, the label goes first, so the files are ordered alphabetically by row label."
    },
    printNulls: {
        key: "p", description: "When importing 2DAs, null values will no longer be stripped out of the resulting YMLs."
    },
    _meta_: { args: 1 },
})

// Do some quick preprocessing on parameters, for internal consistency.
if(typeof options.filterType === "string")
    options.filterType = [options.filterType]
if(typeof options.schema === "string")
    options.schema = [options.schema]

console.log(options)

if(options.import) {
    await unpackFrom2DA(options)
}
else {
    await packTo2DA(options)
}