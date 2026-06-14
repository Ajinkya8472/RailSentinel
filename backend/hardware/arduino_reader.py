"""
arduino_reader.py — Optional hardware integration.

Reads MPU-6050 vibration + temperature over USB serial and injects
the reading into the sensor stream using inject_reading().

To enable: set ARDUINO_PORT in .env (e.g. COM3 on Windows, /dev/ttyUSB0 on Linux)
If the port is unavailable the reader exits silently — simulation continues.

Usage:
    asyncio.create_task(run_arduino_reader())
"""

import os
import json
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

ARDUINO_PORT     = os.getenv("ARDUINO_PORT", "COM3")
ARDUINO_BAUD     = int(os.getenv("ARDUINO_BAUD", "9600"))
ARDUINO_TRAIN_ID = os.getenv("ARDUINO_TRAIN_ID", "T001")   # which train the sensor represents


async def run_arduino_reader() -> None:
    """
    Background task: reads lines from Arduino serial port.

    Expected Arduino serial output format (one JSON line per reading):
        {"v": 1.23, "t": 46.5}
        v = vibration (g-force equivalent)
        t = temperature (°C)

    The task exits gracefully if pyserial is not installed or port not found.
    """
    try:
        import serial  # pyserial
    except ImportError:
        logger.warning("[Arduino] pyserial not installed — hardware reader disabled.")
        return

    from models.database import SessionLocal
    from models.train_model import Train
    from services.sensor_generator import inject_reading

    try:
        ser = serial.Serial(ARDUINO_PORT, ARDUINO_BAUD, timeout=2)
        logger.info(f"[Arduino] Connected to {ARDUINO_PORT} at {ARDUINO_BAUD} baud.")
    except serial.SerialException as e:
        logger.warning(f"[Arduino] Cannot open {ARDUINO_PORT}: {e}. Hardware reader disabled.")
        return

    while True:
        try:
            raw_line = ser.readline().decode("utf-8", errors="ignore").strip()
            if not raw_line:
                await asyncio.sleep(0.1)
                continue

            data = json.loads(raw_line)
            vibration   = float(data.get("v", 1.0))
            temperature = float(data.get("t", 45.0))

            db = SessionLocal()
            try:
                train = db.query(Train).filter(Train.id == ARDUINO_TRAIN_ID).first()
                if not train:
                    logger.warning(f"[Arduino] Train {ARDUINO_TRAIN_ID} not in DB yet.")
                    continue

                # Compute deviation sigma using default baseline
                baseline_vib = 1.0
                baseline_std = 0.15
                sigma = round((vibration - baseline_vib) / baseline_std, 2)
                is_spike = vibration >= 2.8 or temperature >= 78.0

                reading = {
                    "vibration":       round(vibration, 4),
                    "temperature":     round(temperature, 2),
                    "deviation_sigma": sigma,
                    "is_spike":        is_spike,
                }

                await inject_reading(train, reading, db, source="arduino")
                logger.info(
                    f"[Arduino] vib={vibration:.3f} temp={temperature:.1f}°C "
                    f"σ={sigma:.2f} spike={is_spike}"
                )
            finally:
                db.close()

        except json.JSONDecodeError:
            logger.debug(f"[Arduino] Non-JSON line: {raw_line}")
        except Exception as e:
            logger.error(f"[Arduino] Read error: {e}", exc_info=True)

        # Arduino typically sends at 10 Hz — yield to event loop between reads
        await asyncio.sleep(0.1)
