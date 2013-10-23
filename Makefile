all: copy-script minify-script

include ../../build/modules.mk

MODULE = bootloader
SOURCE_SCRIPT_FILE_PREFIX = 