# Usamos la base que ya conoces
FROM osrf/ros:humble-desktop

# Instalamos todo lo necesario de una vez
RUN apt-get update && apt-get install -y \
    ros-humble-rosbridge-suite \
    ros-humble-web-video-server \
    ros-humble-cv-bridge \
    python3-opencv \
    nano \
    && rm -rf /var/lib/apt/lists/*

# Bake the ROS 2 Python path into the image so rclpy works in any
# docker exec call without needing to manually source setup.bash
ENV PYTHONPATH=/opt/ros/humble/lib/python3.10/site-packages:/opt/ros/humble/local/lib/python3.10/dist-packages
ENV ROS_DISTRO=humble
ENV AMENT_PREFIX_PATH=/opt/ros/humble
ENV COLCON_PREFIX_PATH=/opt/ros/humble
ENV LD_LIBRARY_PATH=/opt/ros/humble/lib

# Copiamos tu script de radar adentro del contenedor
COPY radar_visual.py /radar_visual.py

# Copiamos todos los scripts de animación
COPY animations/ /animations/
RUN chmod +x /animations/*.sh

# Creamos un script de inicio automático
RUN echo '#!/bin/bash \n\
    source /opt/ros/humble/setup.bash \n\
    ros2 run web_video_server web_video_server & \n\
    ros2 launch rosbridge_server rosbridge_websocket_launch.xml address:=0.0.0.0 & \n\
    python3 /radar_visual.py' > /start.sh && chmod +x /start.sh

# Al encender el contenedor, ejecutará todo automáticamente
ENTRYPOINT ["/start.sh"]