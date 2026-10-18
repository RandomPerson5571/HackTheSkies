"""Export the pinned food-trained YOLO11n-Seg checkpoint for local tracking.

Run with Python + ultralytics, onnx, onnxruntime and onnxslim installed.
The segmentation backbone/detection weights are retained; mask outputs and
branches are pruned because the app only renders bounding boxes.
"""
import hashlib
from pathlib import Path
import tempfile
import shutil
import sys
import urllib.request

import numpy as np
import onnx
import onnxruntime as ort
from onnx import helper, TensorProto
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
REVISION = "4b766bcfc0e249deca6912229bbb3956beacac05"
URL = f"https://huggingface.co/kris-0918/lidar-food-measurable-yolo11n-seg/resolve/{REVISION}/best.pt"
DEST = ROOT / "apps/mobile/assets/models/food-yolo11n-416.onnx"

with tempfile.TemporaryDirectory() as work:
    checkpoint = Path(work) / "best.pt"
    if len(sys.argv) > 1:
        shutil.copyfile(sys.argv[1], checkpoint)
    else:
        urllib.request.urlretrieve(URL, checkpoint)
    checksum = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    assert checksum == "42753a3e59c845aa147bf46192a7602cfd4dd19ad2869679bd73157eef8dac0d", checksum
    print("Checkpoint SHA256:", checksum)
    model = YOLO(str(checkpoint))
    exported = model.export(format="onnx", imgsz=416, batch=1, dynamic=False,
                            simplify=True, opset=17, device="cpu")
    graph = onnx.load(exported)
    raw_output = graph.graph.output[0].name
    # Exported segmentation output has 4 box + 1 class + 32 mask channels.
    for name, value in [("box_starts", [0]), ("box_ends", [5]), ("box_axes", [1])]:
        graph.graph.initializer.append(helper.make_tensor(name, TensorProto.INT64, [1], value))
    graph.graph.node.append(helper.make_node("Slice", [raw_output, "box_starts", "box_ends", "box_axes"], ["food_boxes"]))
    del graph.graph.output[:]
    graph.graph.output.append(helper.make_tensor_value_info("food_boxes", TensorProto.FLOAT, [1, 5, 3549]))
    sliced = Path(work) / "sliced.onnx"
    onnx.save(graph, sliced)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    onnx.utils.extract_model(str(sliced), str(DEST), [graph.graph.input[0].name], ["food_boxes"])
    # Optimizer removes unused mask branches and folds constants.
    from onnxslim import slim
    onnx.save(slim(str(DEST)), str(DEST))
    onnx.checker.check_model(str(DEST))
    session = ort.InferenceSession(str(DEST), providers=["CPUExecutionProvider"])
    result = session.run(None, {session.get_inputs()[0].name: np.zeros((1, 3, 416, 416), dtype=np.float32)})
    assert result[0].shape == (1, 5, 3549), result[0].shape
    assert np.isfinite(result[0]).all()
    original = ort.InferenceSession(str(exported), providers=["CPUExecutionProvider"])
    sample = np.random.default_rng(42).random((1, 3, 416, 416), dtype=np.float32)
    expected = original.run(None, {original.get_inputs()[0].name: sample})[0][:, :5, :]
    actual = session.run(None, {session.get_inputs()[0].name: sample})[0]
    np.testing.assert_allclose(actual, expected, rtol=1e-4, atol=1e-3)
    print("Pruned export matches original box outputs.")
    print("Asset:", DEST, "bytes:", DEST.stat().st_size)
    print("Asset SHA256:", hashlib.sha256(DEST.read_bytes()).hexdigest())
