"""Bake the reference photographs onto a fixed UV surface."""

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, map_coordinates
import xatlas


def vertex_normals(vertices, faces):
    corners = vertices[faces]
    face_normals = np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0])
    normals = np.zeros_like(vertices)
    for index in range(3):
        np.add.at(normals, faces[:, index], face_normals)
    return normals / np.maximum(1e-8, np.linalg.norm(normals, axis=1, keepdims=True))


def surface_samples(vertices, faces, uv, normals, width, height):
    """Rasterize positions and normals at the texel centers of each UV chart."""
    screen = uv * [width, -height] + [-.5, height - .5]
    positions = np.zeros((height, width, 3), dtype=np.float32)
    directions = np.zeros_like(positions)
    used = np.zeros((height, width), dtype=bool)

    for face in faces:
        triangle = screen[face]
        x0, y0 = np.maximum(0, np.ceil(triangle.min(axis=0))).astype(int)
        x1, y1 = np.minimum([width - 1, height - 1], np.floor(triangle.max(axis=0))).astype(int)
        if x0 > x1 or y0 > y1:
            continue
        a, b, c = triangle
        ab, ac = b - a, c - a
        area = ab[0] * ac[1] - ab[1] * ac[0]
        if abs(area) < 1e-8:
            continue
        y, x = np.ogrid[y0:y1 + 1, x0:x1 + 1]
        u = ((x - a[0]) * ac[1] - (y - a[1]) * ac[0]) / area
        v = (ab[0] * (y - a[1]) - ab[1] * (x - a[0])) / area
        mask = (u >= -1e-5) & (v >= -1e-5) & (u + v <= 1.00001)
        weights = np.stack([1 - u[mask] - v[mask], u[mask], v[mask]], axis=1)
        rows = slice(y0, y1 + 1)
        columns = slice(x0, x1 + 1)
        positions[rows, columns][mask] = weights @ vertices[face]
        directions[rows, columns][mask] = weights @ normals[face]
        used[rows, columns] |= mask

    return positions[used], directions[used], used


def front_depth(volume, grid, yaw):
    """Find the visible depth of the same volume from a reference camera."""
    xs, ys, zs = grid
    u = xs[:, None]
    depth = np.linspace(-1.62, 1.62, 145, dtype=np.float32)
    c, s = np.cos(yaw), np.sin(yaw)
    x = (c * u - s * depth - xs[0]) / (xs[1] - xs[0])
    z = (s * u + c * depth - zs[0]) / (zs[1] - zs[0])
    y = np.arange(len(ys), dtype=np.float32)[:, None, None]
    coords = np.broadcast_arrays(y, x[None, :, :], z[None, :, :])
    filled = map_coordinates(volume, coords, order=1, mode="constant", cval=-1) > -.012
    return np.where(filled, depth, -1.8).max(axis=2)


def photograph_colors(points, normals, volume, grid, photos, dimensions):
    width, height, center_y = dimensions
    xs, ys, _ = grid
    texel_y = .5 - (points[:, 1] - center_y) / height
    row_on_grid = (points[:, 1] - ys[0]) / (ys[1] - ys[0])
    color_sum = np.zeros((len(points), 3), dtype=np.float32)
    weight_sum = np.zeros(len(points), dtype=np.float32)
    fallback_color = np.zeros_like(color_sum)
    fallback_score = np.full(len(points), -1, dtype=np.float32)

    for index, photo in enumerate(photos):
        yaw = index * np.pi / 4
        c, s = np.cos(yaw), np.sin(yaw)
        u = c * points[:, 0] + s * points[:, 2]
        depth = -s * points[:, 0] + c * points[:, 2]
        facing = -s * normals[:, 0] + c * normals[:, 2]
        col = (.5 + u / width) * photo.shape[1] - .5
        row = texel_y * photo.shape[0] - .5
        coords = np.array([row, col])
        alpha = map_coordinates(photo[..., 3], coords, order=1, mode="constant", cval=0)
        estimated_depth = map_coordinates(
            front_depth(volume, grid, yaw),
            [row_on_grid, (u - xs[0]) / (xs[1] - xs[0])],
            order=1, mode="nearest",
        )
        occluded = np.maximum(0, estimated_depth - depth - .032)
        visible = np.exp(-(occluded / .092) ** 2)
        confidence = np.clip(facing + .14, .06, 1) ** 5 * visible * alpha ** 2
        if index == 0:
            confidence *= 1.45

        _, nearest = distance_transform_edt(photo[..., 3] < .55, return_indices=True)
        filled = photo[nearest[0], nearest[1], :3].astype(np.float32)
        color = np.stack(
            [map_coordinates(filled[..., channel], coords, order=1, mode="nearest") for channel in range(3)],
            axis=1,
        )
        color_sum += color * confidence[:, None]
        weight_sum += confidence

        score = facing + alpha * .28
        take = score > fallback_score
        fallback_color[take] = color[take]
        fallback_score[take] = score[take]

    missing = np.maximum(0, .001 - weight_sum)
    return (color_sum + fallback_color * missing[:, None]) / np.maximum(.001, weight_sum[:, None])


def bake_bouquet_texture(vertices, faces, volume, grid, photos, dimensions, target):
    vertices = np.ascontiguousarray(vertices, dtype=np.float32)
    faces = np.ascontiguousarray(faces, dtype=np.uint32)
    normals = vertex_normals(vertices, faces)

    atlas = xatlas.Atlas()
    atlas.add_mesh(vertices, faces)
    packing = xatlas.PackOptions()
    packing.resolution = 1672
    packing.padding = 5
    atlas.generate(pack_options=packing)
    mapping, triangles, uv = atlas[0]
    packed_vertices = vertices[mapping]
    points, directions, used = surface_samples(
        packed_vertices, triangles, uv, normals[mapping], atlas.width, atlas.height,
    )
    directions /= np.maximum(1e-8, np.linalg.norm(directions, axis=1, keepdims=True))
    colors = photograph_colors(points, directions, volume, grid, photos, dimensions)
    canvas = np.zeros((*used.shape, 3), dtype=np.uint8)
    canvas[used] = np.clip(colors * 255 + .5, 0, 255).astype(np.uint8)

    # Pad every chart with its nearest surface color for filtered mipmaps.
    gutter = distance_transform_edt(~used, return_distances=False, return_indices=True)
    Image.fromarray(canvas[gutter[0], gutter[1]]).save(target, "WEBP", quality=90, method=6)
    print(f"Texture atlas: {atlas.width}×{atlas.height}, {used.sum():,} surface samples")
    return packed_vertices, triangles, uv
