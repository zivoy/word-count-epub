import zipfile
import os

def create_epub(filename):
    with zipfile.ZipFile(filename, 'w') as z:
        # 1. Mimetype (must be first, uncompressed)
        z.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        
        # 2. Container
        container_xml = '''<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>'''
        z.writestr('META-INF/container.xml', container_xml)
        
        # 3. Content OPF
        content_opf = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Test Book</dc:title>
        <dc:language>en</dc:language>
        <dc:identifier id="BookId">urn:uuid:12345</dc:identifier>
    </metadata>
    <manifest>
        <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
        <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine>
        <itemref idref="ch1"/>
        <itemref idref="ch2"/>
    </spine>
</package>'''
        z.writestr('OEBPS/content.opf', content_opf)
        
        # 4. TOC (EPUB 3)
        toc_xhtml = '''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>TOC</title></head>
<body>
    <nav epub:type="toc">
        <ol>
            <li><a href="chapter1.xhtml">Chapter One</a></li>
            <li><a href="chapter2.xhtml">Chapter Two</a></li>
        </ol>
    </nav>
</body>
</html>'''
        z.writestr('OEBPS/toc.xhtml', toc_xhtml)
        
        # 5. Chapters
        ch1 = '''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
    <h1>Chapter One</h1>
    <p>This is the first chapter. It has some words.</p>
    <p>Here are more words to count.</p>
</body>
</html>'''
        z.writestr('OEBPS/chapter1.xhtml', ch1)
        
        ch2 = '''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body>
    <h1>Chapter Two</h1>
    <p>This is the second chapter. It is shorter.</p>
</body>
</html>'''
        z.writestr('OEBPS/chapter2.xhtml', ch2)

if __name__ == '__main__':
    create_epub('test.epub')
    print('Created test.epub')
