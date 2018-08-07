# -*- coding: utf-8 -*-
import os
import argparse
from PIL import Image
from PIL import ImageOps
from PIL import ImageFilter
from PIL import ImageEnhance
from cv2 import bilateralFilter
import numpy as np
import cv2
from matplotlib import pyplot as plt 

def crop_image_uniform(src_dir, dst_dir):
    f = open("399-uniform.txt", "r")
    if not os.path.exists(dst_dir):
        os.makedirs(dst_dir)
    for page in range(1,4):
        img = Image.open( src_dir + "/" + str(page) +"-uniform.png").convert('L')
	opencv_img = np.array(img)
	# apply threshold OTSU
	th = cv2.threshold(opencv_img, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU) 
        width, height = img.size
        cell_width = width/float(cols)
        cell_height = height/float(rows)
        header_offset = height/float(rows) * header_ratio
        width_margin = int(cell_width * 0.12)
        height_margin = int(cell_height * 0.12)
	
        for j in range(0,rows):
            for i in range(0,cols):
                left = int(i * cell_width)
                upper = int(j * cell_height + header_offset)
                right = int(left + cell_width)
                lower = int((j+1) * cell_height)
		
		 
		# slice part of array [upper:lower,left:right]
		array=th[1]
		Array = array[ upper+height_margin : lower-height_margin, left+width_margin : right-width_margin ] 

		list_X = list()
		list_Y = list()

		for q in range(len(Array)): # size of row
		    for p in range(len(Array[q])): # size of col
		  	if Array[q][p] == 0: # it is black, store in list_X,Y 
			    list_X.append(p)
			    list_Y.append(q)

		code = f.readline()
		if not(list_X and list_Y): 
		    continue;
		else: # exist list_X and list_Y
		    center_x = sum(list_X) / len(list_X) + left + width_margin
		    center_y = sum(list_Y) / len(list_Y) + upper + height_margin
               
		    # Determine the width and height size of the actual character size
		    crop_width = max(list_X) - min(list_X)  + width_margin
                    crop_height = max(list_Y) - min(list_Y) + height_margin
		
		
		    left = center_x-crop_width/2
		    right = center_x+crop_width/2 
		    upper = center_y-crop_height/2 
		    lower = center_y+crop_height/2 

		    cropped_image = img.crop((left, upper, right, lower))
		    height_size = 0
		    width_size = 0

		    # create an image White-background with size 128*128
		    ground = Image.new("RGB",(128,128),(255,255,255)).convert('L')
		    
		    # resize according to width and height
 		    if crop_width > crop_height: 
                        height_size = 90*crop_height/crop_width
		        cropped_image = cropped_image.resize((90,height_size), Image.LANCZOS)
		        ground.paste(cropped_image,(19,int(64-height_size/2)))
                    else:
                        width_size = 90*crop_width/crop_height
		        cropped_image = cropped_image.resize((width_size,90), Image.LANCZOS)
		        ground.paste(cropped_image,(int(64-width_size/2),19))

		
                    
                    if not code:
                        break
                    else:
                        name = dst_dir + "/uni" + code.strip() + ".png"

                        # Increase constrast
                        enhancer = ImageEnhance.Contrast(ground)
                        ground = enhancer.enhance(1.5)
                        opencv_image = np.array(ground)
                        opencv_image = bilateralFilter(opencv_image, 9, 30, 30)
                        ground = Image.fromarray(opencv_image)
                        ground.save(name)

        print("Processed uniform page " + str(page))


parser = argparse.ArgumentParser(description='Crop scanned images to character images')
parser.add_argument('--src_dir', dest='src_dir', required=True, help='directory to read scanned images')
parser.add_argument('--dst_dir', dest='dst_dir', required=True, help='directory to save character images')
args = parser.parse_args()

if __name__ == "__main__":
    rows = 12
    cols = 12
    header_ratio = 16.5/(16.5+42)
    crop_image_uniform(args.src_dir, args.dst_dir)
#    crop_image_frequency(args.src_dir, args.dst_dir)
