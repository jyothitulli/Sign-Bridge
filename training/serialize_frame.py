#!/usr/bin/env python3
"""Serialize MediaPipe Holistic results to SignBridge JSON frame format (matches browser export)."""


def _flat_landmarks(landmark_list):
    if not landmark_list:
        return []
    out = []
    for lm in landmark_list:
        out.extend([lm.x, lm.y, lm.z])
    return out


def holistic_to_frame(result, timestamp_ms: int) -> dict:
    pose = result.pose_landmarks
    left = result.left_hand_landmarks
    right = result.right_hand_landmarks
    face = result.face_landmarks

    return {
        "pose": _flat_landmarks(pose.landmark if pose else None),
        "leftHand": _flat_landmarks(left.landmark if left else None),
        "rightHand": _flat_landmarks(right.landmark if right else None),
        "face": _flat_landmarks(face.landmark if face else None),
        "timestamp": timestamp_ms,
    }


def frame_has_hands(frame: dict, min_hand_pts=21) -> bool:
    lh = len(frame.get("leftHand", [])) // 3
    rh = len(frame.get("rightHand", [])) // 3
    return lh >= min_hand_pts or rh >= min_hand_pts
