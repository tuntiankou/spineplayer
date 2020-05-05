from PIL import Image
import glob
from os import path, walk
import re
 
res = r"D:\\DOWNLOAD\\girls\\梦幻模拟战\Spine\\avator\\Texture2D"

def Test1(res): 
    list_dirs = walk(res) 
    temp = dict()
    for root, _, files in list_dirs:  
        for f in files: 
            name = re.search(r'(.+?)(_a)?( #\d+)?\.png', f)
            if (name == None) :
                print("Error File:", f)
                continue
           
            if (name.group(2) != None and name.group(3) == None ):                
                print (path.join(root, name.group(1)+".png"), path.join(root, f) )
                merge(path.join(root, name.group(1)+".png"), path.join(root, f))




def merge(image, mask):

    
    img = Image.open(image)
    mas = Image.open(mask)
    
    pixdata_img = img.load()
    pixdata_mas = mas.load()
    
    for y in range(mas.size[1]):
        for x in range(mas.size[0]):
            pixdata_img[x, y] = (pixdata_img[x, y][0], pixdata_img[x, y][1], pixdata_img[x, y][2], pixdata_mas[x, y][2])
    
    img.save(image)

Test1(res)