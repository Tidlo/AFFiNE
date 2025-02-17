import { Utils } from '@tldraw/core';
import Vec from '@tldraw/vec';
import type { ShapeStyles } from '@toeverything/components/board-types';
import getStroke, { getStrokePoints } from 'perfect-freehand';
import { getOffsetPolygon, getShapeStyle } from '../shared';
function getPonits(w: number, h: number) {
    return [
        [w / 5, 0],
        [(w / 5) * 4, 0],
        [w, h / 2],
        [(w / 5) * 4, h],
        [w / 5, h],
        [0, h / 2],
    ];
}

export function getHexagonPoints(size: number[], offset = 0, rotation = 0) {
    const [w, h] = size;
    let points = getPonits(w, h);
    if (offset) points = getOffsetPolygon(points, offset);
    if (rotation)
        points = points.map(pt => Vec.rotWith(pt, [w / 2, h / 2], rotation));

    return points;
}

export function getHexagonCentroid(size: number[]) {
    const [w, h] = size;
    const points = getPonits(w, h);
    return [
        (points[0][0] + points[1][0] + points[2][0]) / 3,
        (points[0][1] + points[1][1] + points[2][1]) / 3,
    ];
}

function getHexagonDrawPoints(id: string, size: number[], strokeWidth: number) {
    const [w, h] = size;
    const getRandom = Utils.rng(id);
    // Random corner offsets
    const offsets = Array.from(Array(6)).map(() => {
        return [
            getRandom() * strokeWidth * 0.75,
            getRandom() * strokeWidth * 0.75,
        ];
    });
    // Corners
    const point = getPonits(w, h);
    const corners = [
        Vec.add(point[0], offsets[0]),
        Vec.add(point[1], offsets[1]),
        Vec.add(point[2], offsets[2]),
        Vec.add(point[3], offsets[3]),
        Vec.add(point[4], offsets[4]),
        Vec.add(point[5], offsets[5]),
    ];

    // Which side to start drawing first
    const rm = Math.round(Math.abs(getRandom() * 2 * 3));
    // Number of points per side
    // Inset each line by the corner radii and let the freehand algo
    // interpolate points for the corners.
    const lines = Utils.rotateArray(
        [
            Vec.pointsBetween(corners[0], corners[1], 32),
            Vec.pointsBetween(corners[1], corners[2], 32),
            Vec.pointsBetween(corners[2], corners[3], 32),
            Vec.pointsBetween(corners[3], corners[4], 32),
            Vec.pointsBetween(corners[4], corners[5], 32),
            Vec.pointsBetween(corners[5], corners[0], 32),
        ],
        rm
    );
    // For the final points, include the first half of the first line again,
    // so that the line wraps around and avoids ending on a sharp corner.
    // This has a bit of finesse and magic—if you change the points between
    // function, then you'll likely need to change this one too.
    const points = [...lines.flat(), ...lines[0]];
    return {
        points,
    };
}

function getDrawStrokeInfo(id: string, size: number[], style: ShapeStyles) {
    const { strokeWidth } = getShapeStyle(style);
    const { points } = getHexagonDrawPoints(id, size, strokeWidth);
    const options = {
        size: strokeWidth,
        thinning: 0.65,
        streamline: 0.3,
        smoothing: 1,
        simulatePressure: false,
        last: true,
    };
    return { points, options };
}

export function getHexagonPath(id: string, size: number[], style: ShapeStyles) {
    const { points, options } = getDrawStrokeInfo(id, size, style);
    const stroke = getStroke(points, options);
    return Utils.getSvgPathFromStroke(stroke);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function getHexagonIndicatorPathTDSnapshot(
    id: string,
    size: number[],
    style: ShapeStyles
) {
    const { points, options } = getDrawStrokeInfo(id, size, style);
    const strokePoints = getStrokePoints(points, options);
    return Utils.getSvgPathFromStroke(
        strokePoints.map(pt => pt.point.slice(0, 2)),
        false
    );
}
