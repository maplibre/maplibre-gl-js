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
        const testParams = [{
            translate: [1, 2, -3],
            scaleXY: 10,
            rotAxis: [5, 6, 7],
            rotAngle: Math.PI / 4
        },{
            translate: [0, 0, 0],
            scaleXY: 1,
            rotAxis: [0, 0, 1],
            rotAngle: 0
        },{
            translate: [-50, 100, 0.5],
            scaleXY: 0.01,
            rotAxis: [1, 0, 0],
            rotAngle: Math.PI
        },{
            translate: [1000, -2000, 500],
            scaleXY: 200,
            rotAxis: [0, 1, 0],
            rotAngle: -Math.PI / 6
        },{
            translate: [-0.1, 0.2, -0.3],
            scaleXY: 0.5,
            rotAxis: [1, 1, 0],
            rotAngle: Math.PI / 2
        },{
            translate: [0, 0, -9999],
            scaleXY: 50,
            rotAxis: [0.3, 0.4, 0.5],
            rotAngle: -0.01
        },{
            translate: [42, -7, 13],
            scaleXY: 4,
            rotAxis: [1, -2, 3],
            rotAngle: 2.1
        }];
        const m = mat4.create();
        const mInv = mat4.create();
        const mInvRef = mat4.create();
        for (const {translate, scaleXY, rotAxis, rotAngle} of testParams) {
            // translation vector:
            const v = vec3.create();
            vec3.copy(v, translate);

            // scale vector. sx shoule be = sy:
            const s = vec3.create();
            s[0] = scaleXY;
            s[1] = scaleXY;
            s[2] = 1;

            // quaternion:
            const q = quat.create();
            const axis = vec3.create();
            vec3.copy(axis, rotAxis);
            vec3.normalize(axis, axis);
            quat.setAxisAngle(q, axis, rotAngle);
            mat4.fromRotationTranslationScale(m, q, v, s);

            // compute inv:
            fastInvertTransformMat4(mInv, m);

            // compute ref:
            mat4.invert(mInvRef, m);

            compare_matrix(mInv, mInvRef);
        };
    });

    test('invert a projection matrix', () => {
        const testParams = [
            {
                fov: Math.PI/4,
                aspect: 16/9,
                zNear: 1,
                zFar: 1000
            },
            {
                fov: Math.PI/3,
                aspect: 4/3,
                zNear: 10,
                zFar: 10000
            },
            {
                fov: Math.PI/8,
                aspect: 1,
                zNear: 1,
                zFar: 10
            },
            {
                fov: Math.PI/4,
                aspect: 2,
                zNear: 1,
                zFar: 1000
            }
        ];
        const m = mat4.create();
        const mInv = mat4.create();
        const mInvRef = mat4.create();
        for (const {fov, aspect, zNear, zFar} of testParams) {
            mat4.perspective(m, fov, aspect, zNear, zFar);
            // compute inv:
            fastInvertProjMat4(mInv, m);
            // compute ref:
            mat4.invert(mInvRef, m);
            compare_matrix(mInv, mInvRef);
        };
    });

    test('invert a skew matrix', () => {
        const testParams = [{
            diag: [1, 1, 1, 1],
            counterDiagXY: [0, 0]
        },{
            diag: [2, 3, 4, 5],
            counterDiagXY: [0.5, -0.5]
        },{
            diag: [0.1, 0.2, 0.3, 0.4],
            counterDiagXY: [0.01, -0.01]
        },{
            diag: [10, 10, 10, 1],
            counterDiagXY: [3, -3]
        },{
            diag: [1, 1, 1, 1],
            counterDiagXY: [0.9, -0.9]
        },{
            diag: [100, 200, 50, 1],
            counterDiagXY: [10, 20]
        },{
            diag: [0.5, 0.5, 0.5, 2],
            counterDiagXY: [0, 0]
        },{
            diag: [7, 3, 5, 1],
            counterDiagXY: [-2, 1]
        },{
            diag: [1, 1, 0.01, 1],
            counterDiagXY: [0.5, 0.3]
        },{
            diag: [4, 8, 2, 1],
            counterDiagXY: [-5, 3]
        },{
            diag: [0.3, 0.7, 1.5, 1],
            counterDiagXY: [0.1, -0.2]
        }];
        const m = mat4.create();
        const mInv = mat4.create();
        const mInvRef = mat4.create();
        for(const {diag, counterDiagXY} of testParams) {
            // forge a skew matrix:
            m[0] = diag[0];
            m[5] = diag[1];
            m[10] = diag[2];
            m[15] = diag[3];
            m[4] = counterDiagXY[0];
            m[1] = counterDiagXY[1];

            // compute inv:
            fastInvertSkewMat4(mInv, m);

            // compute ref:
            mat4.invert(mInvRef, m);

            compare_matrix(mInv, mInvRef);
        };
    });
});
