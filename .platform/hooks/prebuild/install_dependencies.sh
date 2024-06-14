#!/bin/bash

# Update package lists
sudo yum update -y

# Install the missing library and its dependencies
sudo yum install -y atk at-spi2-atk cups-libs libXcomposite libXdamage libXrandr libX11 libXcursor libXext libXi libXtst pango alsa-lib nss libXScrnSaver xdg-utils
