#!/usr/bin/env python
import os
import time

f = open('cache.manifest', 'w')
f.write("CACHE MANIFEST\n")
f.write("# rev %s\n" % int(time.time()))

rootdir = "."
for root, folders, files in os.walk(rootdir):
    folders[:] = [x for x in folders if x != '.svn']
    for file in files:
        afile = os.path.normpath(os.path.join(root,file))
        if file[0] != '.' and not file.endswith(('.manifest', '.py')):
            f.write(afile + '\n')

f.close()
