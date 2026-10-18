# Food tracking model

`food-yolo11n-416.onnx` is a derived, bounding-box-only export of
[kris-0918/lidar-food-measurable-yolo11n-seg](https://huggingface.co/kris-0918/lidar-food-measurable-yolo11n-seg).
Source revision: `4b766bcfc0e249deca6912229bbb3956beacac05`.
Source checkpoint SHA256: `42753a3e59c845aa147bf46192a7602cfd4dd19ad2869679bd73157eef8dac0d`.

The original YOLO11n-Seg model was fine-tuned on FoodSeg103 and selected COCO
food examples, collapsed to one `measurable_object` class. The app calls this
class `food`; Groq supplies the dish identity. The author reports validation at
640px; those accuracy figures do not describe this 416px export.

## Contract and performance

- Input: float32 `[1, 3, 416, 416]`, RGB / 255, letterboxed with 114 padding.
- Output: float32 `[1, 5, 3549]`, center x/y, width/height in input pixels, food score.
- ONNX opset 17, IR 8. Mask outputs are removed; app-side NMS is required.
- Asset size: 11,156,407 bytes (FP32); no model download from Hugging Face at runtime.
- Desktop sanity benchmark: Apple M5 CPU, ONNX Runtime 1.31.0, two threads,
  five warmups + 30 runs on a blank input: median 12.68 ms, p95 13.11 ms.
  This excludes capture/preprocessing and is not a phone latency or battery result.
- The app uses ONNX Runtime 1.24.3; final compatibility is also checked with that
  browser runtime. Native camera performance still requires an actual device.

Reproduce from repository root with Python and `ultralytics==8.4.182`,
`torch==2.14.1`, `onnx==1.23.2`, `onnxruntime==1.31.0`, `onnxslim==0.1.98`:

```sh
python scripts/export-food-yolo.py
```

The script downloads the pinned checkpoint, verifies its hash, exports at 416px,
removes unused outputs, checks ONNX validity, runs inference, and compares box
outputs with the original export. An optional local checkpoint path avoids the
download. Further optimization or quantization should be validated against real
food photos before replacing this asset.

## Attribution and license

Upstream model: kris-0918, LiDAR Food Measurable YOLO11n-Seg. Architecture and
training framework: Ultralytics. This derived model is AGPL-3.0; a copy is in
`LICENSE-AGPL-3.0.txt`. Source/export recipe is `scripts/export-food-yolo.py`.
See the upstream model card and THIRD_PARTY_NOTICES.md for FoodSeg103 and COCO
provenance. No source training images are bundled. The model does not require
LiDAR; it only receives RGB pixels. It can merge touching foods and miss unseen
cuisines, transparent foods, or heavily occluded regions.
