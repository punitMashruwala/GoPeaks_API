
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import async from 'async';
import pandoc from 'node-pandoc';
import HtmlDocx from 'html-docx-js';
import pdf2html from 'pdf2html';

const router = express.Router();

const process_dir = "./processed_file/";
const upload_DIR = "./uploads/";
const json_dir = "./json/"

var default_trigger_list = [
    "accordingly",
    "as",
    "as a consequence",
    "as a result",
    "because of",
    "because",
    "cause",
    "causing",
    "consequently",
    "contribute to",
    "contributed to",
    "contributing to",
    "due to",
    "given that",
    "hence",
    "in order to",
    "leading to",
    "leads to",
    "led to",
    "owing to",
    "provided that",
    "result from",
    "so",
    "therefore",
    "thus"
]
let word = "trigger";
let userName = 'Default';

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
        if (extension == 'pdf' || extension == 'doc' || extension == 'docx') {
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
            res.status(400).json(new Error("Please send pdf or docx file only"));
        }

    } else {
        res.status(400).json(new Error("Asset requires a File to be uploaded."));
    }
});

router.post("/process", function (req, res) {
    if (req.body) {
        if (req.body.fileName) {

            let src_file_name = req.body.fileName.split(".")[0];
            src_file_name = src_file_name.split("_")[0];

            let extension = req.body.fileName.split(".")[1];

            let args;
            let src = req.body.fileName;

            let id = req.body.fileName.split(".")[0].split("_")[1];

            if ((!req.body.List || (req.body.List).toLowerCase() != "default") && (req.body.ListArray && req.body.ListArray.length != 0)) {
                default_trigger_list = req.body.ListArray;
            }
            if (req.body.userName) {
                userName = req.body.userName;
            }

            src = upload_DIR + extension + "/" + src;

            if (extension == "pdf") {
                args = `less -f ${extension} -t html5 -o test.txt`;

                pdf2html.html(src, (err, html) => {
                    if (err) {
                        console.error('Conversion error: ' + err);
                        res.status(400).json("Something Went Wrong! Processing Error");
                    } else {
                        processData(req, res, html, id, src_file_name);
                    }
                })

            } else {
                args = `-f ${extension} -t html5`;

                pandoc(src, args, (err, result) => {
                    if (err) {
                        console.error(err);
                        res.status(400).json("Something Went Wrong! Processing Error")
                    } else {
                        processData(req, res, result, id, src_file_name);
                    }
                })
            }


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

function processData(req, res, result, id, src_file_name) {
    let arrayList = [];
    let array = [];
    let fileName;
    let new_file_name;
    async.series([
        function (cb) {
            array = result.split(".");
            console.log("Trigger words array :" + default_trigger_list)
            array.map((i, index) => {
                let upperCaseFlag = false;
                i = i.replace("<p>", "");
                i = i.replace("</p>", "");
                let backup_sentence = i.trim();
                default_trigger_list.map((trigger_word, trigger_index) => {

                    var c = new RegExp('\\b' + trigger_word + '\\b', 'i');
                    if (i.search(c) != -1) {
                        if (i.indexOf("&lt;causal-relation&gt") == -1 && i.indexOf("&lt/causal-relation&gt") == -1) {
                            if (startsWithCapital(i[i.search(c)])) {
                                upperCaseFlag = true;
                            }
                            if (backup_sentence.search(c) == 0) {
                                i = array[index - 1] + ". " + i;
                            }
                            if (i.indexOf("&lt;causal-relation&gt") == -1 && i.indexOf("&lt/causal-relation&gt") == -1) {
                                i = i.replace(/<\/?[^>]+(>|$)/g, "");
                                i = i.replace(/(\r\n|\n|\r)/gm, "");
                                if (i.indexOf("_") != -1) {
                                    var re = /__/gi;
                                    i = i.replace(re, "");
                                }

                                if (trigger_word == "as") {
                                    var d = new RegExp('\\b' + "as well" + '\\b', 'i');
                                    if (i.search(d) == -1) {
                                        if (upperCaseFlag) {
                                            trigger_word = trigger_word.split(' ')
                                                .map(w => w[0].toUpperCase() + w.substr(1).toLowerCase())
                                                .join(' ')
                                        }
                                        i = i.replace(c, ` <font style="color:purple;"> &lt;${word}&gt ${trigger_word} &lt/${word}&gt </font>`)
                                        i = '<font style="color:red;"> &lt;causal-relation&gt; </font> ' + i + ' <font style="color:red;"> &lt/causal-relation&gt </font>';
                                        // i = '<font style="background-color:yellow;"> ' + i + " </font>";
                                        if (i.indexOf("<p>") == -1) {
                                            i = "<p> " + i + "</p> "
                                        }
                                        if (i.indexOf(word) != -1) {
                                            array[index] = i;
                                            arrayList.push(i);
                                        }
                                    }
                                } else {
                                    if (upperCaseFlag) {
                                        trigger_word = trigger_word.split(' ')
                                            .map(w => w[0].toUpperCase() + w.substr(1).toLowerCase())
                                            .join(' ')
                                    }
                                    i = i.replace(c, ` <font style="color:purple;"> &lt;${word}&gt ${trigger_word} &lt/${word}&gt </font>`)
                                    i = '<font style="color:red;"> &lt;causal-relation&gt; </font> ' + i + ' <font style="color:red;"> &lt/causal-relation&gt </font>';
                                    // i = '<font style="background-color:yellow;"> ' + i + " </font>";
                                    if (i.indexOf("<p>") == -1) {
                                        i = "<p> " + i + "</p> "
                                    }
                                    if (i.indexOf(word) != -1) {
                                        array[index] = i;
                                        arrayList.push(i);
                                    }
                                }
                            }

                        } else if (i.indexOf("<p>") == -1) {
                            i = "<p> " + i + "</p> "
                            array[index] = i;
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
                if (arrayList.length > 0) {
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
                    cb("Error! No Data")
                }

            } else {
                cb(null, null);
            }

        }
    ], function (err) {
        // return result;
        if (err) {
            if (err == "Error! No Data") {
                res.status(400).json("!!!No data found!!!");
            } else {
                res.status(400).json("!!!Something Went Wrong!");
            }
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

function startsWithCapital(word) {
    return word.charAt(0) === word.charAt(0).toUpperCase()
}


export default router;
