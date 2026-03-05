import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan, CompressedImage
import cv2
import numpy as np
import math

class RadarVisualizer(Node):
    def __init__(self):
        super().__init__('radar_visualizer')
        self.subscription = self.create_subscription(LaserScan, '/sim_scan', self.scan_callback, 10)
        self.publisher = self.create_publisher(CompressedImage, '/radar_image/compressed', 10)
        self.img_size = 400 
        self.max_dist = 10.0

    def scan_callback(self, msg):
        img = np.zeros((self.img_size, self.img_size, 3), dtype=np.uint8)
        cx, cy = self.img_size // 2, self.img_size // 2
        
        cv2.circle(img, (cx, cy), 2, (0, 255, 0), -1)
        px_m = (self.img_size / 2) / self.max_dist
        for d in [2, 5, 8]:
            cv2.circle(img, (cx, cy), int(d * px_m), (40, 40, 40), 1)

        angle = msg.angle_min
        for r in msg.ranges:
            if not math.isinf(r) and r > 0.1:
                x = int(cx + (r * math.cos(angle) * px_m))
                y = int(cy - (r * math.sin(angle) * px_m))
                if 0 <= x < self.img_size and 0 <= y < self.img_size:
                    cv2.circle(img, (x, y), 2, (0, 0, 255), -1)
            angle += msg.angle_increment

        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 70])
        msg_img = CompressedImage()
        msg_img.format = "jpeg"
        msg_img.data = buffer.tobytes()
        self.publisher.publish(msg_img)

def main():
    rclpy.init()
    rclpy.spin(RadarVisualizer())
    rclpy.shutdown()

if __name__ == '__main__':
    main()