"""Rebuild the bouquet mesh with Pillow, SciPy, scikit-image and fast-simplification."""

from pathlib import Path

import numpy as np
from fast_simplification import simplify
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates
from skimage.measure import marching_cubes


ASSETS = Path(__file__).resolve().parents[1] / "assets"
HEIGHT = 3.90
WIDTH = 2.60
CENTER_Y = .23
STEP = .023


def cutout(name):
    image = Image.open(ASSETS / f"lily-bouquet{name}.webp").convert("RGBA")
    return np.asarray(image) / 255


def distance(alpha):
    inside = gaussian_filter(alpha, .75) > .26
    return (distance_transform_edt(inside) - distance_transform_edt(~inside)) * WIDTH / alpha.shape[1]


def profile(plane, axis):
    inside = plane > 0
    low = np.min(np.where(inside, axis, axis[-1]), axis=1)
    high = np.max(np.where(inside, axis, axis[0]), axis=1)
    return (low + high) / 2, np.maximum((high - low) / 2, STEP)


def sample_grid(image, ws, ys):
    column = (ws / WIDTH + .5) * image.shape[1] - .5
    row = (.5 - (ys - CENTER_Y) / HEIGHT) * image.shape[0] - .5
    coords = np.meshgrid(row, column, indexing="ij")
    return map_coordinates(image, coords, order=1, mode="constant", cval=-2).astype("f")


front, right, back, left = (cutout(name) for name in ("", "-right", "-back", "-left"))
xs = np.arange(-1.38, 1.39, STEP, dtype="f")
ys = np.arange(CENTER_Y - 2.03, CENTER_Y + 2.05, STEP, dtype="f")
zs = np.arange(-1.20, 1.21, STEP, dtype="f")

# Opposing projections share silhouettes. Keep their union so details from the
# front image still have geometry when the photographed angles differ slightly.
front_plane = sample_grid(np.maximum(distance(front[..., 3]), distance(back[..., 3])[:, ::-1]), xs, ys)
side_plane = sample_grid(np.maximum(distance(left[..., 3]), distance(right[..., 3])[:, ::-1]), zs, ys)
x_center, x_radius = profile(front_plane, xs)
z_center, z_radius = profile(side_plane, zs)
x_unit = (xs[None, :] - x_center[:, None]) / x_radius[:, None]
z_unit = (zs[None, :] - z_center[:, None]) / z_radius[:, None]

# Round each horizontal section. A restrained relief from the front photograph
# gives the petals and folded wrapper depth while preserving the source outline.
flower_zone = np.clip((ys - .10) / .68, 0, 1)
strength = (2.05 + .55 * flower_zone)[:, None, None]
luma = front[..., :3] @ [0.2126, 0.7152, 0.0722]
relief = gaussian_filter(luma, 3) - gaussian_filter(luma, 18)
relief *= gaussian_filter(front[..., 3], 5)
raised = sample_grid(relief, xs, ys).clip(-.25, .25) * (.65 + .4 * flower_zone[:, None])
z_with_relief = z_unit[:, None, :] - raised[:, :, None] * np.clip(z_unit[:, None, :], 0, 1)
volume = (1 - np.abs(x_unit[:, :, None]) ** strength - np.abs(z_with_relief) ** strength)
volume *= np.minimum(x_radius, z_radius)[:, None, None]
volume = np.minimum(np.minimum(volume, front_plane[:, :, None]), side_plane[:, None, :])

# Shape the diagonals softly. The source cutouts are slightly different in
# each view, so keep a small margin for the original petal and leaf silhouettes.
for azimuth, first, opposite in [(np.pi / 4, "-315", "-135"), (3 * np.pi / 4, "-225", "-45")]:
    a = distance(cutout(first)[..., 3])
    b = distance(cutout(opposite)[..., 3])[:, ::-1]
    field = np.maximum(a, b)
    projection = np.cos(azimuth) * xs[:, None] + np.sin(azimuth) * zs[None, :]
    column = (projection / WIDTH + .5) * field.shape[1] - .5
    row = (.5 - (ys - CENTER_Y) / HEIGHT) * field.shape[0] - .5
    coordinates = np.broadcast_arrays(row[:, None, None], column[None, :, :])
    diagonal = map_coordinates(field, coordinates, order=1, mode="constant", cval=-.3)
    volume = np.minimum(volume, diagonal + .115)

volume = gaussian_filter(volume, .56)
vertices, faces, _, _ = marching_cubes(volume, level=0, spacing=(STEP, STEP, STEP), allow_degenerate=False)
vertices += [ys[0], xs[0], zs[0]]
vertices = vertices[:, [1, 0, 2]]
vertices, faces = simplify(vertices, faces, target_count=36000)
signed_volume = np.einsum("ij,ij->i", vertices[faces[:, 0]], np.cross(vertices[faces[:, 1]], vertices[faces[:, 2]])).sum()
if signed_volume < 0:
    faces = faces[:, ::-1]

header = (
    f"ply\nformat binary_little_endian 1.0\nelement vertex {len(vertices)}\n"
    "property float x\nproperty float y\nproperty float z\n"
    f"element face {len(faces)}\nproperty list uchar int vertex_indices\nend_header\n"
)
triangles = np.empty(len(faces), dtype=[("count", "u1"), ("indices", "<i4", (3,))])
triangles["count"] = 3
triangles["indices"] = faces
with (ASSETS / "lily-bouquet.ply").open("wb") as output:
    output.write(header.encode("ascii"))
    vertices.astype("<f4").tofile(output)
    triangles.tofile(output)

print(f"{len(vertices):,} vertices, {len(faces):,} triangles")
