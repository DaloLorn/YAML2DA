export default function help() {
    console.info(`Use: node yaml2da [command] [file]
        Currently supported formats:
            - cls_feat_*.2da: Class Feat List

        Available commands: 
            - convert: Converts a YAML2DA file into a 2DA file for use by NWN2. If a folder path is provided, converts all YAML2DA files in that folder.
                Input: fileToConvert.yml OR folderToConvert
                Output: packed/fileToConvert.2da OR folderToConvert/packed/*.2da
                Example: node yaml2da convert cls_feat_mstralhemist.yml
                Aliases:
                    - build
                    - finalize
                    - pack
                    - to2da
                    - export
            - help: Show this help message.
                Input: N/A
                Output: This help message.
                Example: node yaml2da help
            - prepare: Converts a 2DA file into a YAML2DA file for further editing. If a folder path is provided, tries to convert all 2DAs in that folder.
                Input: fileToConvert.2da OR folderToConvert
                Output: unpacked/fileToConvert.yml OR folderToConvert/unpacked/*.yml
                Example: node yaml2da prepare cls_feat_mstralchemist.2da
                Aliases:
                    - unpack
                    - import
                    - from2da`);
}