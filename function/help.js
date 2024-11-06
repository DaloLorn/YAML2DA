export default function help() {
    console.info(`Use: node yaml2da [command] [file]
        Currently supported formats:
            - cls_feat_*.2da (cls_feat): Class Feat List
            - race_feat_*.2da (race_feat): Race Feat List

        Available commands: 
            - export: Converts a YAML2DA file into a 2DA file for use by NWN2. If a folder path is provided, exports all YAML2DA files in that folder.
                Input: 
                    - fileToExport.yml OR folderToExport: File or folder to export to 2DA.
                    - filterType: If exporting a folder, specifies the yamlType to export. If omitted, exports all files with a valid yamlType.
                Output: packed/fileToConvert.2da OR folderToConvert/packed/*.2da
                Example: node yaml2da convert cls_feat_mstralhemist.yml
                Aliases:
                    - build
                    - finalize
                    - pack
                    - to2da
                    - convert
            - help: Show this help message.
                Input: N/A
                Output: This help message.
                Example: node yaml2da help
            - import: Converts a 2DA file into a YAML2DA file for further editing. If a folder path is provided, tries to import all 2DAs in that folder that are in a YAML2DA-recognized format.
                Input: fileToConvert.2da OR folderToConvert
                Output: unpacked/fileToConvert.yml OR folderToConvert/unpacked/*.yml
                Example: node yaml2da prepare cls_feat_mstralchemist.2da
                Aliases:
                    - unpack
                    - import
                    - from2da`);
}