# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2022-08-11

- Fix: Guard against determining menu position with cursor out of document range

- Change: only write `[name]` and match text to `turbo-frame[src]`, don't alter
  `trix-mentions[src]`

## [0.1.0] - 2022-08-07

- Add support for reading the URL directly from `trix-mentions[src]`, then
  falling back to `turbo-frame[src]`.

## [0.1.0] - 2022-08-07

- Initial release
