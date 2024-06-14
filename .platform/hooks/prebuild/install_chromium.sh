#!/bin/bash

# Update package lists
sudo yum update -y

# Install necessary dependencies
sudo yum install -y \
    alsa-lib \
    at-spi2-atk \
    atk \
    cups-libs \
    libXcomposite \
    libXdamage \
    libXrandr \
    libXft \
    pango \
    xdg-utils \
    libXScrnSaver \
    libXcursor \
    libXi \
    libXtst \
    libxkbcommon \
    libdrm \
    mesa-libgbm \
    glib2 \
    nss \
    libgcrypt \
    libxcb \
    fontconfig \
    dejavu-sans-fonts \
    dejavu-sans-mono-fonts \
    dejavu-serif-fonts \
    liberation-mono-fonts \
    liberation-sans-fonts \
    liberation-serif-fonts \
    google-noto-emoji-fonts \
    google-noto-fonts-common \
    google-noto-sans-fonts \
    google-noto-serif-fonts \
    google-noto-sans-cjk-ttc-fonts

# Install wget for downloading Chromium
sudo yum install -y wget

# Download the latest stable release of Chromium
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm

# Install the downloaded Chromium package
sudo yum localinstall -y google-chrome-stable_current_x86_64.rpm

# Cleanup
rm -f google-chrome-stable_current_x86_64.rpm

# Verify font installation
fc-list :family
