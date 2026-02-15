// --- 32-BIT COLOR PACKING (ABGR Format) ---
export const packColor = (r: number, g: number, b: number, a: number = 255) => {
    return (a << 24) | (b << 16) | (g << 8) | r;
};

// --- COLOR BLENDING (ABGR) ---
export const blendColor = (bg: number, fg: number) => {
    // Unpack BG (ABGR)
    const bgR = bg & 0xFF;
    const bgG = (bg >> 8) & 0xFF;
    const bgB = (bg >> 16) & 0xFF;

    // Unpack FG (ABGR)
    const fgR = fg & 0xFF;
    const fgG = (fg >> 8) & 0xFF;
    const fgB = (fg >> 16) & 0xFF;
    const fgA = (fg >> 24) & 0xFF; // Alpha 0-255

    const alpha = fgA / 255;
    const invAlpha = 1 - alpha;

    const r = Math.floor(fgR * alpha + bgR * invAlpha);
    const g = Math.floor(fgG * alpha + bgG * invAlpha);
    const b = Math.floor(fgB * alpha + bgB * invAlpha);

    return packColor(r, g, b, 255); // Result is opaque
};

export const COLORS_32 = {
    OCEAN: packColor(14, 165, 233, 0),     // #0ea5e9 (Alpha 0 - Tamamen transparan)
    OCEAN_VISIBLE: packColor(14, 165, 233, 255), // Mavi deniz
    LAND_BASE: packColor(243, 231, 200),   // #f3e7c8 (Kara - Düz arazi)
    // Terrain Types
    MOUNTAIN: packColor(139, 115, 85),     // #8b7355 (Dağlar - Kahverengi)
    FOREST: packColor(34, 139, 34),        // #228b22 (Orman - Koyu yeşil)
    DESERT: packColor(237, 201, 175),      // #edc9af (Çöl - Bej)
    PLAYER_INNER: packColor(134, 239, 172, 100), // Şeffaf yeşil alan (alpha 100)
    PLAYER_BORDER: packColor(16, 185, 129, 255), // Belirgin yeşil sınır (alpha 255)
    HIGHLIGHT: packColor(244, 63, 94),     // #f43f5e
    // Bot Renkleri - Şeffaf iç, belirgin sınır
    BOT1_INNER: packColor(248, 113, 113, 100),  // Şeffaf kırmızı
    BOT1_BORDER: packColor(220, 38, 38, 255),   // Belirgin kırmızı sınır
    BOT2_INNER: packColor(147, 197, 253, 100),  // Şeffaf mavi
    BOT2_BORDER: packColor(37, 99, 235, 255),   // Belirgin mavi sınır
    BOT3_INNER: packColor(253, 224, 71, 100),   // Şeffaf sarı
    BOT3_BORDER: packColor(202, 138, 4, 255),   // Belirgin sarı sınır
    BOT4_INNER: packColor(216, 180, 254, 100),  // Şeffaf mor
    BOT4_BORDER: packColor(168, 85, 247, 255),  // Belirgin mor sınır
    // Fabrika
    FACTORY: packColor(120, 120, 120),     // Gri
};

export interface Factory {
    id: number;
    index: number;
    x: number;  // Canvas X koordinatı
    y: number;  // Canvas Y koordinatı
    level: number;
}
