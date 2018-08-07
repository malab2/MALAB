var express = require('express');
var router = express.Router();
const { exec, execSync, spawn } = require('child_process');
var multer = require('multer');
var fs = require('fs');
var svg2ttf = require('svg2ttf');
var svgicons2svgfont = require('svgicons2svgfont');
//const SVGIcons2SVGFontStream = require('svgicons2svgfont');

var fontStream = svgicons2svgfont({
  fontName: 'myfontPDU'  
});

var ImageTracer = require('./public/javascripts/imagetracer_v1.2.1');
var PNG = require('pngjs').PNG;
var files;
var option = {    'ltres' : 1,
        'qtres' : 1,
        'strokewidth' : 0.1,
        'pathomit' : 8,
        'blurradius' : 0,
        'blurdelta' : 10 };

//start
var doing_training = false;
var training_progress = [];
var root_dir;
var scan_dir;
var crop_dir;
var data_dir;
var model_dir;
var image_dir;
var logs_dir;
var result_dir;
var flipped_result_dir;

/* Create working directory */
root_dir = 'neural-fonts/'+new Date().toUTCString().replace(/ /gi, "").replace(/,/gi, "").replace(/:/gi,"_");
scan_dir = root_dir + "/scanned_image";
crop_dir = root_dir + "/cropped_image";
data_dir = root_dir + "/data";
model_dir = root_dir + "/checkpoint";
image_dir = root_dir + "/image";
logs_dir = root_dir + "/logs";
result_dir = root_dir + "/result";
flipped_result_dir = "/flipped_result";

execSync('mkdir -p ./' + root_dir);         // root directory
execSync('mkdir -p ./' + scan_dir);         // scanned image directory
execSync('mkdir -p ./' + crop_dir);         // cropped image directory
execSync('mkdir -p ./' + data_dir);         // data directory
execSync('mkdir -p ./' + image_dir);        // image data directory
execSync('mkdir -p ./' + logs_dir);         // log data directory
execSync('mkdir -p ./' + result_dir);       // result data directory
execSync('mkdir -p ./' + flipped_result_dir);       // result data directory

fs.closeSync(fs.openSync(logs_dir + '/progress', 'w'));    // create an empty file to check progress
execSync('cp -r neural-fonts/binary/baseline/checkpoint ' + root_dir + "/.");    // model directory (copy baseline model)

var storage = multer.diskStorage({
destination: function (req, file, callback) {
callback(null, 'neural-fonts/' + scan_dir);
},
filename: function (req, file, callback) {
callback(null, file.originalname);
// TODO: check file name (e.g., 1-frequency.png)
}
});
var upload = multer({storage:storage}).array('fontPhoto', 3);

// 1. Upload scanned image
console.log('@@upload image start');
execSync('cp uniform/*.png '+root_dir+'/scanned_image/');
console.log('upload image finish!!');
training_progress.push("fileUploaded");

// 2. Crop each character
console.log('@@crop start');
execSync('python neural-fonts/crop.py --src_dir=' + scan_dir + ' --dst_dir=' + crop_dir);
console.log('crop finish!!');
training_progress.push("imageCropped");

// 3. Create image data for training
console.log('@@create image data start');
execSync('python neural-fonts/font2img.py --src_font=neural-fonts/fonts/NanumGothic.ttf --dst_font=neural-fonts/fonts/NanumGothic.ttf --sample_dir=' + image_dir + ' --label=0 --handwriting_dir=' + crop_dir);
console.log('create image data finish!!');
training_progress.push("imgDataCreated");

// 4. Create data object with the image data
console.log('@@create data object start');
execSync('python neural-fonts/package.py --fixed_sample=1 --dir=' + image_dir + ' --save_dir=' + data_dir);
console.log('create data object finish!!');
training_progress.push("dataObjCreated");

// 5. Start training (phase 1)
console.log('@@training (phase1) start');
exec('python neural-fonts/train.py --experiment_dir=' + root_dir + ' --experiment_id=0 --batch_size=16 --lr=0.001 --epoch=60 --sample_steps=100 --schedule=20  --L1_penalty=100 --Lconst_penalty=15 --freeze_encoder=1', (error, stdout, stderr) => {		
    if (error)
      console.log(error);    
});
training_progress.push("firstPhaseTrained");

var training_count = 0;

// 6. Start training (phase 2)
if (training_progress.length >= 4) {	
	count=0;
	while(count == 0){
		let data = fs.readFileSync(logs_dir + '/progress', {encoding:'utf8'});
		var count = (data.match(/Done/g) || []).length;
	}
	if (count == 1 && training_count == 0) {
		console.log('1st Training Done');
		console.log('@@training (phase2) start');
		exec('python neural-fonts/train.py --experiment_dir=' + root_dir + ' --experiment_id=0 --batch_size=16 --lr=0.001 --epoch=120 --sample_steps=100 --schedule=30  --L1_penalty=500 --Lconst_penalty=1000 --freeze_encoder=1', (error, stdout, stderr) => {
		if (error){
		  console.log(error);
		}
		});
		training_count++;
		training_progress.push("secondPhaseTrained");   
}
}

while(count == 1 && training_count == 0)
{
	let data = fs.readFileSync(logs_dir + '/progress', {encoding:'utf8'});
	var count = (data.match(/Done/g) || []).length;
}
//7. Do inference.
console.log("2nd Training Done");
console.log("@@infer start");

 exec('python neural-fonts/infer.py --model_dir=' + model_dir + '/experiment_0_batch_16 --batch_size=1 --source_obj=' + data_dir + '/val.obj --embedding_ids=0 --save_dir=' + result_dir + ' --progress_file=' + logs_dir+ '/progress', (error, stdout, stderr) => {
        if (error)
          console.log(error);
	if(stdout !=null)
	{
		//8. flip
		execSync('python neural-fonts/flip_img.py --flip_dir='+root_dir);

		//9. svgicons -> fonst_svg -> ttf
		var sources=[];
		var fileName=[];
		files = fs.readdirSync(root_dir+'/result/');
    		function split_str(st){
        		var split_str = st.split("d=\"");
        		var sub_split_str;
        		var path_str ="";
        		for(var i=1; i<split_str.length; i++){
            			sub_split_str = split_str[i].split("\" />");
            			split_str[i] = sub_split_str[0];
            			path_str = split_str[i] + path_str;
        		}
        		return split_str[0] + 'd=\"' + path_str + '\" />' + sub_split_str[1];
    		}

     		for(var i=0; i<files.length; i++) {
			sources[i] = '0x' + files[i].substring(9,13);
            		fileName[i] = files[i].substring(9,13);
    		}

	     	for(var i=0; i<files.length; i++) {
		    let j = i;
		    var data = fs.readFileSync('./flipped_result/inferred_'+fileName[j]+'.png');	    
		    var png = PNG.sync.read(data);	
		    var myImageData = {width:128, height:128, data:png.data};	
		    var options = {ltres:option.ltres, strokewidth:option.strokewidth, qtres:option.qtres, pathomit:option.pathomit, blurradius:option.blurradius, blurdelta:option.blurdelta};
		    options.pal = [{r:0,g:0,b:0,a:255},{r:255,g:255,b:255,a:255}];
		    options.linefilter=true;
	
		     var svgstring = split_str(ImageTracer.imagedataToSVG( myImageData, options));
		    // console.log(svgstring);
		     fs.writeFileSync('./svg/' + fileName[j] + '.svg', svgstring);
	  	  }
		fontStream.pipe(fs.createWriteStream( './svg_fonts/font_ss.svg'))
	    	.on('finish',function() {
		var ttf = svg2ttf(fs.readFileSync( './svg_fonts/font_ss.svg', 'utf8'), {});
		fs.writeFileSync('./ttf_fonts/myfontPDU.ttf', new Buffer(ttf.buffer));
	   	})
	    	.on('error',function(err) {
			console.log(err);
	    	});
		for (var i=0; i < sources.length; i++) {
		let glyph1 = fs.createReadStream('./svg/' + fileName[i] + '.svg');
		    glyph1.metadata = {
		    unicode: [String.fromCharCode((sources[i]).toString(10))],
		    name: 'uni' + sources[i]
		};

		fontStream.write(glyph1);
	    }
	    fontStream.end();
	}
      });
training_count++;
training_progress.push("Inference");    






