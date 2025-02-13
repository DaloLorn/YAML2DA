export default function build2DA(columns, rows) {
    return {
        file_type: "2DA ",
        file_version: "V2.0",
        columns,
        rows,
    }
}