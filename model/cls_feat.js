import { pickBy } from "lodash-es";

const ClassFeatList = {
    validate: validate,
    pack: pack,
    unpack: unpack,
    postLoad: postLoad,
};
export default ClassFeatList;

function postLoad(file, context) {
    const result = file;
    if(Object.keys(context.files.cls_feat).includes(file.identifier))
        throw new ReferenceError(`Feat list identifier ${file.identifier} is declared twice! Remember that files without an explicit "identifier" field will use their filename as an identifier!`);

    (file.imports || []).forEach((dependency) => {
        // This check shouldn't fail, but leaving it in just in case!
        if(!Object.keys(context.files.cls_feat).includes(dependency)) {
            throw new ReferenceError(`Dependency ${dependency} for feat list ${file.identifier} not found in project! Either it does not exist, or there is a circular dependency somewhere!`);
        }

        Object.entries(context.files.cls_feat[dependency].levels).forEach(([levelNumber, level]) => {                
            const resultLevel = result.levels[levelNumber] || {};
            if(!resultLevel)
                result.levels[levelNumber] = resultLevel;
            if(!resultLevel.unlocks)
                resultLevel.unlocks = {};
            if(!resultLevel.unlocksBonus)
                resultLevel.unlocksBonus = {};
            if(!resultLevel.bonusPicks)
                resultLevel.bonusPicks = {};
            if(!resultLevel.grants)
                resultLevel.grants = {};

            level.unlocks && Object.entries(level.unlocks).forEach(([label, id]) =>
                addYAMLEntry(id, label, resultLevel.unlocks)
            );
            level.unlocksBonus && Object.entries(level.unlocksBonus).forEach(([label, id]) =>
                addYAMLEntry(id, label, resultLevel.unlocksBonus)
            );
            level.bonusPicks && Object.entries(level.bonusPicks).forEach(([label, id]) =>
                addYAMLEntry(id, label, resultLevel.bonusPicks)
            );
            level.grants && Object.entries(level.grants).forEach(([label, id]) =>
                addYAMLEntry(id, label, resultLevel.grants)
            );
        })
    })

    context.files.cls_feat[result.identifier] = result;
}

function validate(list) {
    if(!list.yamlType) {
        return [
            "FeatLabel",
            "FeatIndex",
            "List",
            "GrantedOnLevel",
        ].every(column => list.columns?.includes(column));
    }
    else {
        return list.yamlType === "cls_feat";
    }
}

const GRANT_TYPES = {
    UNLOCK: 0,
    UNLOCK_BONUS: 1,
    BONUS_PICK: 2,
    GRANT: 3,
};

function add2DAEntry(label, id, grantType, level, output) {
    // Multiple feat IDs may have an identical combination of FeatLabel and GrantedOnLevel!
    // This is represented in YAML2DA as an array of integers instead of a single integer.
    if(typeof id === "object") {
        id.forEach((entryId) => 
            add2DAEntry(label, entryId, grantType, level, output)
        );
    }
    else {
        output.push([
            String(label), // FeatLabel
            String(id), // FeatIndex
            String(grantType), // List
            String(level), // GrantedOnLevel
            "0", // OnMenu
        ]);
    }
}

function pack(list) {
    return Object.entries(list.levels).flatMap(([levelNumber, level]) => {
        if(levelNumber === "always")
            levelNumber = 1;
        else if(levelNumber === "epic")
            levelNumber = list.epicFrom || 21;
        const output = [];
        level.unlocks && Object.entries(level.unlocks).forEach(([label, id]) =>
            add2DAEntry(label, id, GRANT_TYPES.UNLOCK, levelNumber, output)
        );
        level.unlocksBonus && Object.entries(level.unlocksBonus).forEach(([label, id]) =>
            add2DAEntry(label, id, GRANT_TYPES.UNLOCK_BONUS, levelNumber, output)
        );
        level.bonusPicks && Object.entries(level.bonusPicks).forEach(([label, id]) =>
            add2DAEntry(label, id, GRANT_TYPES.BONUS_PICK, levelNumber, output)
        );
        level.grants && Object.entries(level.grants).forEach(([label, id]) => 
            add2DAEntry(label, id, GRANT_TYPES.GRANT, levelNumber, output)
        );
        return output;
    })
}

function addYAMLEntry(featId, featLabel, grantList) {
    const grant = grantList[featLabel];
    if(grant) { // We already grant a different feat with this label on the current level!
        if(typeof grant === "object" && !grant.includes(featId)) {
            grant.push(featId);
        }
        else if(grant !== featId) grantList[featLabel] = [grant, featId];
    }
    else grantList[featLabel] = featId;
}

function unpack(list) {
    // Get column indices for the columns we need to read!
    const FeatIndex = list.columns.findIndex(label => label === "FeatIndex");
    const FeatLabel = list.columns.findIndex(label => label === "FeatLabel");
    const List = list.columns.findIndex(label => label === "List");
    const GrantedOnLevel = list.columns.findIndex(label => label === "GrantedOnLevel");

    const levels = {};
    list.rows.forEach((row) => {
        if(!row[FeatIndex])
            return; // We really don't need to include padding...
        let levelNumber = Number(row[GrantedOnLevel]);
        if(levelNumber < 2 || Number.isNaN(levelNumber)) // Prettify a bit!
            levelNumber = "always";
        else if(levelNumber === 21)
            levelNumber = "epic";

        const level = levels[levelNumber] || {};
        if(!level.unlocks)
            level.unlocks = {};
        if(!level.unlocksBonus)
            level.unlocksBonus = {};
        if(!level.bonusPicks)
            level.bonusPicks = {};
        if(!level.grants)
            level.grants = {};
        let grantList;
        switch(row[List]) {
            case GRANT_TYPES.UNLOCK:
            default:
                grantList = level.unlocks;
                break;
            case GRANT_TYPES.UNLOCK_BONUS:
                grantList = level.unlocksBonus;
                break;
            case GRANT_TYPES.BONUS_PICK:
                grantList = level.bonusPicks;
                break;
            case GRANT_TYPES.GRANT:
                grantList = level.grants;
                break;
        }
        addYAMLEntry(Number(row[FeatIndex]), row[FeatLabel], grantList);
        levels[levelNumber] = pickBy(level);
    })
    return {
        yamlType: "cls_feat",
        levels,
        generateOutput: true,
    };
}