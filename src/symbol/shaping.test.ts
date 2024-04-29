import {PositionedIcon, applyTextFit, Box} from './shaping';
import {ImagePosition} from '../render/image_atlas';
import {StyleImage, TextFit} from '../style/style_image';

describe('applyTextFit', () => {

    describe('applyTextFitHorizontal', () => {
        // This set of tests against applyTextFit starts with a 100x20 image with a 5,5,95,15 content box
        // that has been scaled to 4x4... resulting in a 14x14 image.
        const left = 0;
        const top = 0;
        const right = 14;
        const bottom = 14;
        const rectangle = {x: 0, y: 0, w: 100, h: 20};
        const content: [number, number, number, number] = [5, 5, 95, 15];

        test('applyTextFit: not specified', async () => {
            // No change should happen
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 14, y2: 14});
        });

        test('applyTextFit: stretchOrShrink', async () => {
            // No change should happen
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                textFitWidth: TextFit.stretchOrShrink,
                textFitHeight: TextFit.stretchOrShrink,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 14, y2: 14});
        });

        test('applyTextFit: stretchOnly, proportional', async () => {
            // Since textFitWidth is stretchOnly, it should be returned to
            // the aspect ratio of the content rectangle (9:1) aspect ratio so 126x14.
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                textFitWidth: TextFit.stretchOnly,
                textFitHeight: TextFit.proportional,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 126, y2: 14});
        });
    });

    describe('applyTextFitVertical', () => {
        // This set of tests against applyTextFit starts with a 20x100 image with a 5,5,15,95 content box
        // that has been scaled to 4x4... resulting in a 14x14 image.
        const left = 0;
        const top = 0;
        const right = 14;
        const bottom = 14;
        const rectangle = {x: 0, y: 0, w: 20, h: 100};
        const content: [number, number, number, number] = [5, 5, 15, 95];

        test('applyTextFit: proportional, stretchOnly', async () => {
            // Since the rectangle is wider than tall, when it matches based on width (because that is proportional),
            // then the height will stretch to match the content so we also get a 14x14 image.
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                textFitWidth: TextFit.proportional,
                textFitHeight: TextFit.stretchOnly,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 14, y2: 126});
        });
    });
});
