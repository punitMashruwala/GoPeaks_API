
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import async from 'async';
import pandoc from 'node-pandoc';
import HtmlDocx from 'html-docx-js';

const router = express.Router();

const process_dir = "./processed_file/";
const upload_DIR = "./uploads/";
const json_dir = "./json/"

var default_trigger_list = [
    "because of",
    "as a result",
    "thus",
    "hence",
    "because",
    "so",
    "as",
    "provided that",
    "in order to", "given that",
    "cause",
    "causing",
    "led to",
    "leads to",
    "leading to",
    "contribute to",
    "contributed to",
    "contributing to", "Because of",
    "consequently",
    "therefore",
    "thus",
    "accordingly",
    "as a consequence",
    "due to",
    "owing to",
    "result from"
]
let word = "trigger";
let userName = 'Default';
let arrayList = [];

router.get("/download/:id", function (req, res) {
    if (req.params.id) {
        var name = req.params.id + ".docx";
        var fileData = fs.readFileSync(process_dir + name);
        res.writeHead(200, {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        });
        res.end(fileData);
    } else {
        res.status(400).json()
    }
});


router.post("/upload", function (req, res) {
    req.headers["access-control-allow-origin"] = "*";
    console.log("In API")
    let file = (req.files);
    if (file.file) file = file.file;
    if (file) {
        var originalName = file.name;
        var temp = originalName.split(".");
        var extension = temp[temp.length - 1];
        let id = uuidv4();
        var dir = upload_DIR + extension;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        let fileName = temp[0] + "_" + id + "." + extension;
        var desPath = dir + "/" + fileName;
        let data;
        if (file.buffer) {
            data = file.buffer
        } else {
            data = file.data
        }
        fs.writeFile(desPath, data, err => {
            if (err) {
                res.status(400).json({ message: err.message });
            } else {
                res.status(200).json({ "message": "File is saved Successfully", "fileName": fileName });
            }
        })
    } else {
        res.status(400).json(new Error("Asset requires a File to be uploaded."));
    }
});

router.post("/process", function (req, res) {
    if (req.body) {
        if (req.body.fileName) {

            let src_file_name = req.body.fileName.split(".")[0];
            let extension = req.body.fileName.split(".")[1];
            let args = `-f ${extension} -t html5`;
            let src = req.body.fileName;
            // res.send("Success")
            src_file_name = src_file_name.split("_")[0];
            let id = req.body.fileName.split(".")[0].split("_")[1];
            if ((!req.body.List || (req.body.List).toLowerCase() != "default") && (req.body.ListArray && req.body.ListArray.length != 0)) {
                default_trigger_list = req.body.ListArray;
            }
            if (req.body.userName) {
                userName = req.body.userName;
            }
            let array = [];
            let fileName;
            src = upload_DIR + extension + "/" + src
            // var fileData = fs.readFileSync(src);
            let new_file_name;
            pandoc(src, args, (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(400).json("Something Went Wrong! Processing Error")
                } else {
                    async.series([
                        function (cb) {
                            array = result.split(". ");
                            console.log("Trigger words array :" + default_trigger_list)
                            array.map((i, index) => {
                                default_trigger_list.map((trigger_word, trigger_index) => {
                                    // .search(/\bfoo\b/)
                                    var c = new RegExp('\\b' + trigger_word + '\\b');
                                    if (i.search(c) != -1) {
                                        // if (i.indexOf(trigger_word) != -1) {
                                        if (i.indexOf("&lt;causal-relation&gt") == -1) {
                                            // let regexWord = `(\s|^)${trigger_word}(?=\s|$)`;
                                            i = i.replace(c, `<font style="color:purple;"> &lt;${word}&gt ${trigger_word} &lt/${word}&gt </font>`)
                                            i = '<font style="color:red;"> &lt;causal-relation&gt; </font>' + i + '<font style="color:red;"> &lt/causal-relation&gt </font>';
                                            i = '<font style="background-color:yellow;">' + i + " </font>";
                                            // replace('','$1aaaa');
                                            array[index] = i;
                                            arrayList.push(i);
                                        }
                                    }
                                })
                                if (index == (array.length - 1)) {
                                    console.log("Loop of array ends");
                                    cb(null, array);
                                }
                            })
                        },
                        function (cb) {
                            if (req.body.download) {
                                let ndata = array.join(". ").replace("< trigger>", "<trigger>");
                                ndata = ndata.replace("< causal-relation>", "<causal-relation>");
                                // TO convert Html format data into Word Docx format
                                var docx = HtmlDocx.asBlob(ndata);
                                fileName = `${process_dir}${src_file_name}_${userName}_${id}.docx`;
                                // To write the data into a docx file
                                fs.writeFile(fileName, docx, function (err) {
                                    if (err) {
                                        console.log(fileName, "-----------------", err);
                                        cb(err)
                                    } else {
                                        cb(null, null);
                                    }
                                });
                            } else {
                                cb(null, null);
                            }

                        },
                        function (cb) {
                            if (req.body.editable) {
                                new_file_name = `${json_dir}${src_file_name}_${userName}_${id}.txt`;
                                fs.writeFile(new_file_name, JSON.stringify(arrayList), function (err) {
                                    if (err) {
                                        console.log(new_file_name, "-----------------", err);
                                        cb(err)
                                    } else {
                                        cb(null, null);
                                    }
                                });
                            } else {
                                cb(null, null);
                            }

                        }
                    ], function (err) {
                        // return result;
                        if (err) {
                            res.status(400).json("!!!Something Went Wrong!");
                        } else {
                            let obj = { "Message": "File Processed and saved" };
                            if (req.body.editable) {
                                obj["editableFileName"] = new_file_name;

                            } else if (req.body.download) {
                                obj["downloadFileName"] = fileName;
                            }
                            res.status(200).json(obj)
                        }
                    })
                }
            })
        } else {
            res.status(400).json("Something Went Wrong! File Error")
        }
    } else {
        res.status(400).json("Something Went Wrong!")
    }
})

router.get("/getAnnotateData/:id", function (req, res) {
    if (req.params) {
        if (req.params.id) {

            let src_file_name = "json/" + req.params.id + ".txt";
            fs.readFile(src_file_name, 'utf8', function (err, data) {
                // Display the file content
                res.status(200).send({ data: JSON.parse(data) });
            });
        } else {
            res.status(400).send("");
        }
    } else {
        res.status(400).send("");
    }
})



export default router;