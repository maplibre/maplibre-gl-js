import Color from './color';
import Padding from './padding';

export function number(a: number, b: number, t: number) {
    return (a * (1 - t)) + (b * t);
}

export function color(from: Color, to: Color, t: number) {
    return new Color(
        number(from.r, to.r, t),
        number(from.g, to.g, t),
        number(from.b, to.b, t),
        number(from.a, to.a, t)
    );
}

export function array(from: Array<number>, to: Array<number>, t: number): Array<number> {
    return from.map((d, i) => {
        return number(d, to[i], t);
    });
}

export function padding(from: Padding, to: Padding, t: number): Padding {
    const fromVal = from.values;
    const toVal = to.values;
    return new Padding([
        number(fromVal[0], toVal[0], t),
        number(fromVal[1], toVal[1], t),
        number(fromVal[2], toVal[2], t),
        number(fromVal[3], toVal[3], t)
    ]);
}
