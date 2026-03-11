import { describe, it, expect } from 'vitest';
import { packColor, blendColor } from './gameUtils';

describe('gameUtils', () => {
    describe('packColor', () => {
        it('should correctly pack a red color (opaque)', () => {
            // R=255, G=0, B=0, A=255
            // Expected: (255 << 24) | (0 << 16) | (0 << 8) | 255
            const result = packColor(255, 0, 0, 255);
            // 0xFF0000FF as signed 32-bit integer
            expect(result).toBe(-16776961);
        });

        it('should correctly pack a green color (opaque)', () => {
            // R=0, G=255, B=0, A=255
            const result = packColor(0, 255, 0, 255);
            expect(result).toBe(-16711936);
        });

        it('should correctly pack a blue color (opaque)', () => {
            // R=0, G=0, B=255, A=255
            const result = packColor(0, 0, 255, 255);
            expect(result).toBe(-65536);
        });

        it('should use default alpha of 255 when not provided', () => {
            const withExplicitAlpha = packColor(100, 150, 200, 255);
            const withDefaultAlpha = packColor(100, 150, 200);
            expect(withDefaultAlpha).toBe(withExplicitAlpha);
        });

        it('should correctly pack a fully transparent color', () => {
            const result = packColor(0, 0, 0, 0);
            expect(result).toBe(0);
        });

        it('should correctly pack a semi-transparent white', () => {
            // R=255, G=255, B=255, A=128
            const result = packColor(255, 255, 255, 128);
            // (128 << 24) | (255 << 16) | (255 << 8) | 255
            // -2147483648 | 0x00FF0000 | 0x0000FF00 | 0x000000FF
            // -2147483648 | 16777215
            // = -2130706433
            expect(result).toBe(-2130706433);
        });
    });

    describe('blendColor', () => {
        it('should return foreground color when it is opaque', () => {
            const bg = packColor(0, 0, 0); // Black
            const fg = packColor(255, 255, 255); // White
            const result = blendColor(bg, fg);
            expect(result).toBe(fg);
        });

        it('should return background color when foreground is fully transparent', () => {
            const bg = packColor(255, 0, 0); // Red
            const fg = packColor(0, 255, 0, 0); // Green transparent
            const result = blendColor(bg, fg);
            // Result should be opaque Red because blendColor returns packColor(..., 255)
            expect(result).toBe(packColor(255, 0, 0, 255));
        });

        it('should blend colors correctly (50% opacity)', () => {
            const bg = packColor(0, 0, 0); // Black
            const fg = packColor(255, 255, 255, 128); // White 50% (approx)
            // Alpha = 128/255 ≈ 0.50196
            // R = floor(255 * 0.50196 + 0) = 128
            // G = 128
            // B = 128
            // Result alpha is forced to 255
            const result = blendColor(bg, fg);
            const expected = packColor(128, 128, 128, 255);
            expect(result).toBe(expected);
        });
    });
});
