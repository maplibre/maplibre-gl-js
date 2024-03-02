with open('charset.txt', 'w') as f:
    for i in range(256):
        if chr(i).isprintable():
            f.write(f'{chr(i)}\n')
