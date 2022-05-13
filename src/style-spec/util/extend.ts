export default function extendBy(output: any, ...inputs: Array<any>) {
    for (const input of inputs) {
        for (const k in input) {
            output[k] = input[k];
        }
    }
    return output;
}
