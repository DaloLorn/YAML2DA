import ClassFeatList from "../model/cls_feat.js"
import RaceFeatList from "../model/race_feat.js"
import { keys, every, forEach, values, omit, pickBy, negate, size, isNull, times, isEmpty, mapValues } from "lodash-es";
import build2DA from "./build_2da.js";
import { parse } from "yaml"
import { readFile } from 'fs/promises'

const ModelTypes = {
    cls_feat: ClassFeatList,
    race_feat: RaceFeatList,
    //bgcraft_herbs: BGCraftHerbs,
    load,
};

// Load defaultSchemas.yml before we continue!
(parse(await readFile(new URL(import.meta.resolve("../defaultSchemas.yml")), "utf-8"))).schemas.map(load);
export default ModelTypes;

function load(schema) {
    // If the user accidentally triggers a reload of defaultSchemas.yml, overrule them!
    if(schema.identifier === "defaultSchemas")
        return;

    let loaded = false;
    const { schemas, typeName, labelField } = schema;
    if(typeName) {
        if(["load", "schema", "unknown"].includes(typeName))
            console.error(`Failed to load external schema: ${typeName} is a reserved keyword!`)
        else {
            ModelTypes[typeName] = {
                postLoad: buildLoader(schema),
                validate: buildValidator(schema),
                pack: buildPacker(schema),
                unpack: buildUnpacker(schema),
                // Multi-file schemas cannot be procedurally defined yet!
                hasMultipleFiles: false,
                typeName,
                labelField,
            }
            loaded = true;
        }
    }
    if(schemas) {
        loaded = loaded || schemas.filter(load).length > 0;
    }
    if(!loaded)
        throw new TypeError(`Schema ${schema.identifier} has no type!`);
    return loaded;
}

function buildLoader(schema) {
    const { typeName } = schema;
    return (file, context) => {
        let result = file;
        if(keys(context.files[typeName]).includes(file.identifier))
            throw new ReferenceError(`${typeName} identifier ${file.identifier} is declared twice! Remember that files without an explicit "identifier" field will use their lowercased filename as an identifier!`);

        (file.inherits || []).forEach(dependency => {
            // This check shouldn't fail, but leaving it in just in case!
            if(!keys(context.files[typeName]).includes(dependency)) {
                throw new ReferenceError(`Dependency ${dependency} for ${typeName} ${file.identifier} not found in project! Either it does not exist, or there is a circular dependency somewhere!`);
            }

            result = {
                // First we apply all the ancestor's data...
                ...dependency,
                // Then we override it!
                ...result,
            }
        })
        context.files[typeName][file.identifier] = result;
    }
}

function buildValidator(schema) {
    const { columns, typeName } = schema;
    return list => {
        if(!list.yamlType) {
            return every(columns, (column, columnName) => column.optional || list.columns.includes(columnName))
        }
        else return list.yamlType === typeName;
    }
}

function getColumnAlias(column) {
    if(typeof column === "string")
        return column;
    else return column.alias;
}

function buildPacker(schema) {
    const { typeName, columns } = schema;
    return files => {
        const rows = [];
        forEach(files, file => {
            if(!Number.isInteger(Number(file.id)))
                return;
            file.id = Math.floor(file.id)
            if(rows[file.id])
                throw new ReferenceError(`Attempted to write to ${typeName} row ID ${file.id} twice! Each row ID must occur only once in the project!`)

            rows[file.id] = [];
            forEach(columns, column => rows[file.id].push(file[getColumnAlias(column)] || null));
        })

        let paddedRows = [];
        for(let i = 0; i < rows.length; i++) {
            paddedRows[i] = rows[i] || times(size(columns), () => null);
        }
        return build2DA(
            keys(columns),
            paddedRows
        )
    }
}

function buildUnpacker(schema) {
    const { typeName, columns, criticalColumns, criticalColumn } = schema;
    return (list, printNulls) => {
        // Get 2DA indices for the columns we need to read!
        // Also all the columns that must exist in a non-padding row!
        const criticalIndices = [];
        const columnIndices = keys(columns).map(column => {
            const index = list.columns.findIndex(label => label === column)
            if(criticalColumns?.includes(column) || column === criticalColumn)
                criticalIndices.push(index);
            return index;
        });

        return list.rows.map((row, id) => {
            if(criticalIndices.every(i => row[columnIndices[i]]) == null)
                return; // We really don't need to generate files for padding/descriptive rows...
            let result = {};
            values(columns).forEach((column, i) => result[getColumnAlias(column)] = row[columnIndices[i]])

            result = omit(result, 'yamlType');

            const resultMinusNulls = pickBy(result, negate(isNull))

            if(isEmpty(resultMinusNulls))
                return; // Doing another quick padding check!
            
            if(!printNulls)
                result = resultMinusNulls

            return {
                yamlType: typeName,
                id,
                ...mapValues(result, value => {
                    const number = Number(value);
                    return !Number.isNaN(number) && value !== null ? number : value;
                }),
            }
        }).filter(row => !!row)
    }
}