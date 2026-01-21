import easyocr

reader = easyocr.Reader(['en'])
result = reader.readtext('test.jpg', detail=0)

print(result)
