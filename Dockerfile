FROM jekyll/jekyll:4

WORKDIR /srv/jekyll

# Install gems into a global path so a host-mounted project directory doesn't hide them.
ENV BUNDLE_PATH=/usr/local/bundle
# Force the listen gem to use polling when fs events are unreliable in mounts
ENV LISTEN_FORCE_POLLING=1

# Copy Gemfile(s) for reproducible builds and install dependencies.
# (If your repo has a Gemfile, this will install the exact gems; if not, remove these two COPY/RUN lines.)
COPY Gemfile Gemfile.lock* ./
RUN bundle install --jobs 4 --retry 3

# Default command uses bundle if Gemfile present.
CMD ["sh", "-c", "if [ -f Gemfile ]; then bundle exec jekyll serve --host 0.0.0.0 --port 4000 --livereload --livereload-port 35729 --watch; else jekyll serve --host 0.0.0.0 --port 4000 --livereload --livereload-port 35729 --watch; fi"]
