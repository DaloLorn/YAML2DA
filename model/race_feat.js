import ClassFeatList from "./cls_feat.js";
import build2DA from "../util/build_2da.js";
import { flatMap, map } from "lodash-es";

const RaceFeatList = {
    validate: validate,
    pack: pack,
    unpack: unpack,
    postLoad: postLoad,
    hasMultipleFiles: true,
};
export default RaceFeatList;

const columns = [
    "FeatLabel",
    "FeatIndex",
];

function postLoad(file, context) {
    const result = file;
    if(Object.keys(context.files.race_feat).includes(file.identifier))
        throw new ReferenceError(`Racial feat list identifier ${file.identifier} is declared twice! Remember that files without an explicit "identifier" field will use their filename as an identifier!`);

    (file.imports || []).forEach((dependency) => {
        // This check shouldn't fail, but leaving it in just in case!
        if(!Object.keys(context.files.race_feat).includes(dependency)) {
            throw new ReferenceError(`Dependency ${dependency} for racial feat list ${file.identifier} not found in project! Either it does not exist, or there is a circular dependency somewhere!`);
        }

        Object.entries(context.files.race_feat[dependency].feats).forEach(([label, id]) => {
            addYAMLEntry(id, label, result.feats)
        })
    })

    context.files.race_feat[result.identifier] = result;
}

function validate(list) {
    if(!list.yamlType) {
        // Strict subset of cls_feat columns. Not good: We don't want
        // to convert cls_feat 2DAs to race_feat! 
        return columns.every(column => list.columns?.includes(column)) && !ClassFeatList.validate(list);
    }
    else {
        return list.yamlType === "race_feat";
    }
}

function add2DAEntry(label, id, output) {
    // Multiple feat IDs may have an identical FeatLabel!
    // This is represented in YAML2DA as an array of integers instead of a single integer.
    if(typeof id === "object") {
        id.forEach((entryId) => 
            add2DAEntry(label, entryId, output)
        );
    }
    else {
        output.push([
            String(label), // FeatLabel
            String(id), // FeatIndex
        ]);
    }
}

function pack(list) {
    return build2DA(
        columns,
        flatMap(list.feats, (id, label) => {
            const output = [];
            add2DAEntry(label, id, output);
            return output;
        }),
    )
}

function addYAMLEntry(featId, featLabel, featList) {
    const grant = featList[featLabel];
    if(grant) { // We already grant a different feat with this label!
        if(typeof grant === "object" && !grant.includes(featId)) {
            grant.push(featId);
        }
        else if(grant !== featId) featList[featLabel] = [grant, featId];
    }
    else featList[featLabel] = featId;
}

function unpack(list) {
    // Get column indices for the columns we need to read!
    const FeatIndex = list.columns.findIndex(label => label === "FeatIndex");
    const FeatLabel = list.columns.findIndex(label => label === "FeatLabel");

    const feats = {};
    list.rows.forEach((row) => {
        if(row[FeatIndex] == null)
            return; // We really don't need to include padding...
        addYAMLEntry(Number(row[FeatIndex]), row[FeatLabel], feats);
    })
    return {
        yamlType: "race_feat",
        feats,
        generateOutput: true,
    };
}