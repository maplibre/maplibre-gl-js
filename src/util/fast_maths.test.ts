import {describe, test, expect} from 'vitest';
import {mat4, vec3, quat} from 'gl-matrix';
import {fastInvertTransformMat4, fastInvertProjMat4, fastInvertSkewMat4} from './fast_maths';

function compare_matrix(mat: mat4, matRef: mat4){
    for (let i=0; i<16; ++i){
        expect(mat[i]).toBeCloseTo(matRef[i], 6);
    }
}

describe('fast_maths', () => {
    test('invert a transform matrix', () => {
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

        compare_matrix(mInv, mInvRef);
    });

    test('invert a projection matrix', () => {
        // forge a projection matrix:
        const m = mat4.create();
        mat4.perspective(m, Math.PI/3, 16/9, 1, 1000);

        // compute inv:
        const mInv = mat4.create();
        fastInvertProjMat4(mInv, m);

        // compute ref:
        const mInvRef = mat4.create();
        mat4.invert(mInvRef, m);

        compare_matrix(mInv, mInvRef);
    });

    test('invert a skew matrix', () => {
        // forge a skew matrix:
        const m = mat4.create();
        mat4.fromZRotation(m, Math.PI/3);
        mat4.multiplyScalar(m, m, 3.3);

        // compute inv:
        const mInv = mat4.create();
        fastInvertSkewMat4(mInv, m);

        // compute ref:
        const mInvRef = mat4.create();
        mat4.invert(mInvRef, m);

        console.log(m, mInv, mInvRef);
        compare_matrix(mInv, mInvRef);
    });
});
