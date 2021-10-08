/*
 * @description:
 * @Author: kongkehan
 * @Date: 2021-09-26 10:39:58
 * @LastEditors: kongkehan
 * @LastEditTime: 2021-10-08 16:09:14
 */
import fs from "fs";
import chalk from "chalk";
import symbols from "log-symbols";
import inquirer from "inquirer";
import jscodeshift from "jscodeshift";

const initFn = () => {
    inquirer
        .prompt([
            {
                type: 'input',
                name: 'tsxPath',
                message: 'tsx文件名称(带后缀, 可添加路径, 如 index.tsx 或 src/pages/index.tsx)\n',
                validate: (val) => Boolean(val) || '文件夹的名称不能为空',
            },
        ])
        .then(({ tsxPath }) => middleHandel(tsxPath));
};

const middleHandel = tsxPath => {
    if (tsxPath[0] === '/') tsxPath = tsxPath.slice(1);
    const pathArr = tsxPath.split('/');

    if (pathArr.includes('') || !fs.existsSync(tsxPath)) {
        console.log(symbols.error, chalk.red(`${tsxPath} 路径错误或文件不存在`));
        return;
    }

    const fileName = pathArr[pathArr.length - 1].replace('.tsx', '');
    const fileSource = fs.readFileSync(tsxPath, 'utf-8');

    const astResult = AstCssWithTree(fileName, fileSource);
    astResult
        ? console.log(symbols.success, `${fileName}.scss 创建成功!`)
        : console.log(symbols.success, `${fileName}.scss 创建大失败!`);
};

const AstCssWithTree = (fileName, fileSource) => {
    const root = jscodeshift(fileSource);
    const signMap = new Map([
        ["className", "."],
        ["class", "."],
        ["id", "#"]
    ]);

    const resArr = [];
    root.find(jscodeshift.JSXAttribute).forEach(path => {
        let level = 0;
        let tempParent = path.parentPath;

        // 获取节点的层级
        while (tempParent.parentPath !== null) {
            if (tempParent.name === "body") break;
            tempParent = tempParent.parentPath;
            level++;
        }

        const attrSign = signMap.get(path.value.name.name);
        const attrValue = path.value.value.value;

        // 暂时不处理除classname以外的
        attrSign === "." &&
            resArr.push({
                // 层级约去数字
                level: level / 2 - 1,
                attrValue: attrSign + attrValue
            });
    });

    const cssTree = {};
    resArr.forEach(({ level, attrValue }, index) => {
        if (index === 0) {
            Object.assign(cssTree, {
                level,
                attrValue,
                children: []
            });
        } else {
            let tempItem = cssTree.children;
            if (tempItem.length === 0 || tempItem[0].level === level) {
                tempItem.push({
                    level,
                    attrValue,
                    children: []
                });
            } else {
                // 往下寻找level相近的层级
                // 因为是DFS遍历的方式，所以直接挂在数组最后一个是没问题的
                let lastIndex = tempItem.length - 1;
                while (tempItem[lastIndex].level < level - 1) {
                    tempItem = tempItem[lastIndex].children;
                    lastIndex = tempItem.length - 1;
                }
                tempItem[lastIndex].children.push({
                    level,
                    attrValue,
                    children: []
                });
            }
        }
    });

    const parseToStr = obj => {
        let childStr = "";
        if (obj.children.length > 0) {
            childStr = obj.children.reduce((prev, current) => {
                return prev + parseToStr(current);
            }, "");
        }

        // 缩进处理
        const spaceStr = new Array(obj.level - 1).fill("\t").join("");
        const start = "\r" + spaceStr;
        const end = spaceStr + "}\n";

        return obj.attrValue.split(" ").reduce((prev, current, index) => {
            if (index === 0) {
                const isChild = childStr === "" ? "\n" : "";
                return prev + `${start}${current} {${isChild}${childStr}${end}`;
            } else {
                const sign = obj.attrValue[0];
                return prev + `${start}${sign + current} {\n${end}`;
            }
        }, "");
    };

    const fileContent = parseToStr(cssTree).slice(1);
    const fileNameWithPath = `${__dirname}/${fileName}.scss`;
    const jsonFile = fs.createWriteStream(fileNameWithPath);

    try {
        jsonFile.write(fileContent);
        jsonFile.end();
        return true;
    } catch (e) {
        return false;
    }
};

export default astCss;
