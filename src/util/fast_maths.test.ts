import {test, expect} from 'vitest';
import {mat4, vec3, quat} from 'gl-matrix';
import {fastInvertTransformMat4} from './fast_maths';

test('fast_maths', () => {
    // forge a transform matrix:
    const m = mat4.create();

    // translation vector:
    const v = vec3.create();
    v[0] = 1;
    v[1] = 2;
    v[2] = -3;

    // scale vector. sx shoule be = sy:
    const s = vec3.create();
    s[0] = 10;
    s[1] = 10;
    s[2] = 1;

    // quaternion:
    const q = quat.create();
    const axis = vec3.create();
    axis[0] = 5;
    axis[1] = 6;
    axis[2] = 7;
    vec3.normalize(axis, axis);
    quat.setAxisAngle(q, axis, Math.PI/4);

    mat4.fromRotationTranslationScale(m, q, v, s);

    // compute inv:
    const mInv = mat4.create();
    fastInvertTransformMat4(mInv, m);

    // compute ref:
    const mInvRef = mat4.create();
    mat4.invert(mInvRef, m);

    for (let i=0; i<16; ++i){
        expect(mInv[i]).toBeCloseTo(mInvRef[i], 6);
    }
});
