FROM node:20

# Install basic development tools
RUN apt update && apt install -y less man-db sudo

# Install Ruby and development tools for Jekyll documentation
RUN apt install -y ruby-full ruby-dev build-essential

# Install Bundler
RUN gem install bundler

# Configure Bundler to use vendor/bundle by default (no sudo needed)
RUN bundle config set --global path 'vendor/bundle'

# Ensure default `node` user has access to `sudo`
ARG USERNAME=node
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# listen on all interfaces inside the container
ENV HOST=0.0.0.0
