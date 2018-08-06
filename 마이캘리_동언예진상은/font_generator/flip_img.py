##
# -*- coding: utf-8 -*-

import os
import cv2
import matplotlib.pyplot as plt
import argparse

parser = argparse.ArgumentParser(description='flip the images')
parser.add_argument('--flip_dir', dest='flip_dir', required=True, help='directory to flip images')
args = parser.parse_args()

path_dir = args.flip_dir + '/result/'

file_list = os.listdir(path_dir)

for item in file_list:
    print(item)
    img = cv2.imread(path_dir+item)
    _img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    flipped_img = cv2.flip(_img, 0) # 1은 좌우 반전, 0은 상하 반전입니다.
    cv2.imwrite('./flipped_result/'+item,flipped_img)


