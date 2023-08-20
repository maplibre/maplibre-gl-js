export class DictionaryCoder {
    _stringToNumber: {[_: string]: number};
    _numberToString: Array<string>;

    constructor(strings: Array<string>) {
        this._stringToNumber = {};
        this._numberToString = [];
        for (let i = 0; i < strings.length; i++) {
            const string = strings[i];
            this._stringToNumber[string] = i;
            this._numberToString[i] = string;
        }
    }

    encode(string: string) {
        return this._stringToNumber[string];
    }

    decode(n: number) {
        if (n >= this._numberToString.length) throw new Error(`Out of bounds. Index requested n=${n} can't be >= this._numberToString.length ${this._numberToString.length}`);
        return this._numberToString[n];
    }
}
