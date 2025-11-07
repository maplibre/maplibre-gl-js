import type {Formatted, FormattedSection, VerticalAlign} from '@maplibre/maplibre-gl-style-spec';

import type {ImagePosition} from '../render/image_atlas';
import {verticalizePunctuation} from '../util/verticalize_punctuation';
import {warnOnce} from '../util/util';

export type TextSectionOptions = {
    scale: number;
    verticalAlign: VerticalAlign;
    fontStack: string;
};

export type ImageSectionOptions = {
    scale: number;
    verticalAlign: VerticalAlign;
    imageName: string;
};

export type SectionOptions = TextSectionOptions | ImageSectionOptions;

// Max number of images in label is 6401 U+E000–U+F8FF that covers
// Basic Multilingual Plane Unicode Private Use Area (PUA).
const PUAbegin = 0xE000;
const PUAend = 0xF8FF;

export class TaggedString {
    text: string;
    sections: Array<SectionOptions>;
    /** Maps each character in `text` to its corresponding entry in `sections`. */
    sectionIndex: Array<number>;
    imageSectionID: number | null;

    constructor(text: string = '', sections: Array<SectionOptions> = [], sectionIndex: Array<number> = []) {
        this.text = text;
        this.sections = sections;
        this.sectionIndex = sectionIndex;
        this.imageSectionID = null;
    }

    static fromFeature(text: Formatted, defaultFontStack: string) {
        const result = new TaggedString();
        for (let i = 0; i < text.sections.length; i++) {
            const section = text.sections[i];
            if (!section.image) {
                result.addTextSection(section, defaultFontStack);
            } else {
                result.addImageSection(section);
            }
        }
        return result;
    }

    length(): number {
        return [...this.text].length;
    }

    getSection(index: number): SectionOptions {
        return this.sections[this.sectionIndex[index]];
    }

    getSectionIndex(index: number): number {
        return this.sectionIndex[index];
    }

    verticalizePunctuation() {
        this.text = verticalizePunctuation(this.text);
    }

    /**
     * Returns whether the text contains zero-width spaces.
     *
     * Some tilesets such as Mapbox Streets insert ZWSPs as hints for line
     * breaking in CJK text.
     */
    hasZeroWidthSpaces(): boolean {
        return this.text.includes('\u200b');
    }

    trim() {
        const leadingWhitespace = this.text.match(/^\s*/);
        const leadingLength = leadingWhitespace ? leadingWhitespace[0].length : 0;
        // Require a preceding non-space character to avoid overlapping leading and trailing matches.
        const trailingWhitespace = this.text.match(/\S\s*$/);
        const trailingLength = trailingWhitespace ? trailingWhitespace[0].length - 1 : 0;
        this.text = this.text.substring(leadingLength, this.text.length - trailingLength);
        this.sectionIndex = this.sectionIndex.slice(leadingLength, this.sectionIndex.length - trailingLength);
    }

    substring(start: number, end: number): TaggedString {
        const text = [...this.text].slice(start, end).join('');
        const sectionIndex = this.sectionIndex.slice(start, end);
        return new TaggedString(text, this.sections, sectionIndex);
    }

    /**
     * Converts a UTF-16 character index to a UTF-16 code unit (JavaScript character index).
     */
    toCodeUnitIndex(unicodeIndex: number): number {
        return [...this.text].slice(0, unicodeIndex).join('').length;
    }

    toString(): string {
        return this.text;
    }

    getMaxScale() {
        return this.sectionIndex.reduce((max, index) => Math.max(max, this.sections[index].scale), 0);
    }

    getMaxImageSize(imagePositions: {[_: string]: ImagePosition}): {
        maxImageWidth: number;
        maxImageHeight: number;
    } {
        let maxImageWidth = 0;
        let maxImageHeight = 0;
        for (let i = 0; i < this.length(); i++) {
            const section = this.getSection(i);
            if ('imageName' in section) {
                const imagePosition = imagePositions[section.imageName];
                if (!imagePosition) continue;
                const size = imagePosition.displaySize;
                maxImageWidth = Math.max(maxImageWidth, size[0]);
                maxImageHeight = Math.max(maxImageHeight, size[1]);
            }
        }
        return {maxImageWidth, maxImageHeight};
    }

    addTextSection(section: FormattedSection, defaultFontStack: string) {
        this.text += section.text;
        this.sections.push({
            scale: section.scale || 1,
            verticalAlign: section.verticalAlign || 'bottom',
            fontStack: section.fontStack || defaultFontStack,
        } as TextSectionOptions);
        const index = this.sections.length - 1;
        this.sectionIndex.push(...[...section.text].map(() => index));
    }

    addImageSection(section: FormattedSection) {
        const imageName = section.image ? section.image.name : '';
        if (imageName.length === 0) {
            warnOnce('Can\'t add FormattedSection with an empty image.');
            return;
        }

        const nextImageSectionCharCode = this.getNextImageSectionCharCode();
        if (!nextImageSectionCharCode) {
            warnOnce(`Reached maximum number of images ${PUAend - PUAbegin + 2}`);
            return;
        }

        this.text += String.fromCharCode(nextImageSectionCharCode);
        this.sections.push({
            scale: 1,
            verticalAlign: section.verticalAlign || 'bottom',
            imageName,
        } as ImageSectionOptions);
        this.sectionIndex.push(this.sections.length - 1);
    }

    getNextImageSectionCharCode(): number | null {
        if (!this.imageSectionID) {
            this.imageSectionID = PUAbegin;
            return this.imageSectionID;
        }

        if (this.imageSectionID >= PUAend) return null;
        return ++this.imageSectionID;
    }
}
