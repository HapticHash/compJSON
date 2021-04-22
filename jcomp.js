"use strict";

/**
 * Fixing typeof
 * takes value and returns type of value
 * @param  value
 * return typeof value
 */
function getType(value) {
  if (
    function () {
      return value && value !== this;
    }.call(value)
  ) {
    //fallback on 'typeof' for truthy primitive values
    return typeof value;
  }
  return {}.toString
    .call(value)
    .match(/\s([a-z|A-Z]+)/)[1]
    .toLowerCase();
}
/**
 * Iterate over array of objects and call given callback for each item in the array
 * Optionally may take this as scope
 *
 * @param array
 * @param callback
 * @param optional scope
 */
function forEach(array, callback, scope) {
  for (var idx = 0; idx < array.length; idx++) {
    callback.call(scope, array[idx], idx, array);
  }
}

/**
 * The jcomp object handles all of the functions for the main page.  It finds the diffs and manages
 * the interactions of displaying them.
 */
/*global jcomp:true */
var jcomp = {
  LEFT: "left",
  RIGHT: "right",

  EQUALITY: "eq",
  TYPE: "type",
  MISSING: "missing",
  diffs: [],
  requestCount: 0,

  /**
   * Find the differences between the two objects and recurse into their sub objects.
   */
  findDiffs: function (config1, data1, config2, data2) {
    config1.currentPath.push("/");
    config2.currentPath.push("/");

    var key;

    if (data1.length < data2.length) {
      /*
       * This means the second data has more properties than the first.
       * We need to find the extra ones and create diffs for them.
       */
      for (key in data2) {
        if (data2.hasOwnProperty(key)) {
          if (!data1.hasOwnProperty(key)) {
            jcomp.diffs.push(
              jcomp.generateDiff(
                config1,
                jcomp.generatePath(config1),
                config2,
                jcomp.generatePath(config2, "/" + key),
                "The right side of this object has more items than the left side",
                jcomp.MISSING
              )
            );
          }
        }
      }
    }

    /*
     * Now we're going to look for all the properties in object one and
     * compare them to object two
     */
    for (key in data1) {
      if (data1.hasOwnProperty(key)) {
        config1.currentPath.push(key);

        if (!data2.hasOwnProperty(key)) {
          /*
           * This means that the first data has a property which
           * isn't present in the second data
           */
          jcomp.diffs.push(
            jcomp.generateDiff(
              config1,
              jcomp.generatePath(config1),
              config2,
              jcomp.generatePath(config2),
              "Missing property <code>" +
                key +
                "</code> from the object on the right side",
              jcomp.MISSING
            )
          );
        } else {
          config2.currentPath.push(key);

          jcomp.diffVal(data1[key], config1, data2[key], config2);
          config2.currentPath.pop();
        }
        config1.currentPath.pop();
      }
    }

    config1.currentPath.pop();
    config2.currentPath.pop();

    /*
     * Now we want to look at all the properties in object two that
     * weren't in object one and generate diffs for them.
     */
    for (key in data2) {
      if (data2.hasOwnProperty(key)) {
        // no un-used vars
        // val = data1[key];

        if (!data1.hasOwnProperty(key)) {
          jcomp.diffs.push(
            jcomp.generateDiff(
              config1,
              jcomp.generatePath(config1),
              config2,
              jcomp.generatePath(config2, key),
              "Missing property <code>" +
                key +
                "</code> from the object on the left side",
              jcomp.MISSING
            )
          );
        }
      }
    }
  },

  /**
   * Generate the differences between two values.  This handles differences of object
   * types and actual values.
   */
  diffVal: function (val1, config1, val2, config2) {
    if (getType(val1) === "array") {
      jcomp.diffArray(val1, config1, val2, config2);
    } else if (getType(val1) === "object") {
      if (
        ["array", "string", "number", "boolean", "null"].indexOf(
          getType(val2)
        ) > -1
      ) {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2),
            "Both types should be objects",
            jcomp.TYPE
          )
        );
      } else {
        jcomp.findDiffs(config1, val1, config2, val2);
      }
    } else if (getType(val1) === "string") {
      if (getType(val2) !== "string") {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2),
            "Both types should be strings",
            jcomp.TYPE
          )
        );
      } else if (val1 !== val2) {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2),
            "Both sides should be equal strings",
            jcomp.EQUALITY
          )
        );
      }
    } else if (getType(val1) === "number") {
      if (getType(val2) !== "number") {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2),
            "Both types should be numbers",
            jcomp.TYPE
          )
        );
      } else if (val1 !== val2) {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2),
            "Both sides should be equal numbers",
            jcomp.EQUALITY
          )
        );
      }
    } else if (getType(val1) === "boolean") {
      jcomp.diffBool(val1, config1, val2, config2);
    } else if (getType(val1) === "null" && getType(val2) !== "null") {
      jcomp.diffs.push(
        jcomp.generateDiff(
          config1,
          jcomp.generatePath(config1),
          config2,
          jcomp.generatePath(config2),
          "Both types should be nulls",
          jcomp.TYPE
        )
      );
    }
  },

  /**
   * Arrays are more complex because we need to recurse into them and handle different length
   * issues so we handle them specially in this function.
   */
  diffArray: function (val1, config1, val2, config2) {
    if (getType(val2) !== "array") {
      jcomp.diffs.push(
        jcomp.generateDiff(
          config1,
          jcomp.generatePath(config1),
          config2,
          jcomp.generatePath(config2),
          "Both types should be arrays",
          jcomp.TYPE
        )
      );
      return;
    }

    if (val1.length < val2.length) {
      /*
       * Then there were more elements on the right side and we need to
       * generate those differences.
       */
      for (var i = val1.length; i < val2.length; i++) {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2, "[" + i + "]"),
            "Missing element <code>" +
              i +
              "</code> from the array on the left side",
            jcomp.MISSING
          )
        );
      }
    }
    val1.forEach(function (arrayVal, index) {
      if (val2.length <= index) {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1, "[" + index + "]"),
            config2,
            jcomp.generatePath(config2),
            "Missing element <code>" +
              index +
              "</code> from the array on the right side",
            jcomp.MISSING
          )
        );
      } else {
        config1.currentPath.push("/[" + index + "]");
        config2.currentPath.push("/[" + index + "]");

        if (getType(val2) === "array") {
          /*
           * If both sides are arrays then we want to diff them.
           */
          jcomp.diffVal(val1[index], config1, val2[index], config2);
        }
        config1.currentPath.pop();
        config2.currentPath.pop();
      }
    });
  },

  /**
   * We handle boolean values specially because we can show a nicer message for them.
   */
  diffBool: function (val1, config1, val2, config2) {
    if (getType(val2) !== "boolean") {
      jcomp.diffs.push(
        jcomp.generateDiff(
          config1,
          jcomp.generatePath(config1),
          config2,
          jcomp.generatePath(config2),
          "Both types should be booleans",
          jcomp.TYPE
        )
      );
    } else if (val1 !== val2) {
      if (val1) {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2),
            "The left side is <code>true</code> and the right side is <code>false</code>",
            jcomp.EQUALITY
          )
        );
      } else {
        jcomp.diffs.push(
          jcomp.generateDiff(
            config1,
            jcomp.generatePath(config1),
            config2,
            jcomp.generatePath(config2),
            "The left side is <code>false</code> and the right side is <code>true</code>",
            jcomp.EQUALITY
          )
        );
      }
    }
  },

  /**
   * Format the object into the output stream and decorate the data tree with
   * the data about this object.
   */
  formatAndDecorate: function (/*Object*/ config, /*Object*/ data) {
    if (getType(data) === "array") {
      jcomp.formatAndDecorateArray(config, data);
      return;
    }

    jcomp.startObject(config);
    config.currentPath.push("/");

    var props = jcomp.getSortedProperties(data);

    /*
     * If the first set has more than the second then we will catch it
     * when we compare values.  However, if the second has more then
     * we need to catch that here.
     */
    props.forEach(function (key) {
      config.out +=
        jcomp.newLine(config) +
        jcomp.getTabs(config.indent) +
        '"' +
        jcomp.unescapeString(key) +
        '": ';
      config.currentPath.push(key);
      config.paths.push({
        path: jcomp.generatePath(config),
        line: config.line,
      });
      jcomp.formatVal(data[key], config);
      config.currentPath.pop();
    });

    jcomp.finishObject(config);
    config.currentPath.pop();
  },

  /**
   * Format the array into the output stream and decorate the data tree with
   * the data about this object.
   */
  formatAndDecorateArray: function (/*Object*/ config, /*Array*/ data) {
    jcomp.startArray(config);

    /*
     * If the first set has more than the second then we will catch it
     * when we compare values.  However, if the second has more then
     * we need to catch that here.
     */
    data.forEach(function (arrayVal, index) {
      config.out += jcomp.newLine(config) + jcomp.getTabs(config.indent);
      config.paths.push({
        path: jcomp.generatePath(config, "[" + index + "]"),
        line: config.line,
      });

      config.currentPath.push("/[" + index + "]");
      jcomp.formatVal(arrayVal, config);
      config.currentPath.pop();
    });

    jcomp.finishArray(config);
    config.currentPath.pop();
  },

  /**
   * Generate the start of the an array in the output stream and push in the new path
   */
  startArray: function (config) {
    config.indent++;
    config.out += "[";

    if (config.paths.length === 0) {
      /*
       * Then we are at the top of the array and we want to add
       * a path for it.
       */
      config.paths.push({
        path: jcomp.generatePath(config),
        line: config.line,
      });
    }

    if (config.indent === 0) {
      config.indent++;
    }
  },

  /**
   * Finish the array, outdent, and pop off all the path
   */
  finishArray: function (config) {
    if (config.indent === 0) {
      config.indent--;
    }

    jcomp.removeTrailingComma(config);

    config.indent--;
    config.out += jcomp.newLine(config) + jcomp.getTabs(config.indent) + "]";
    if (config.indent !== 0) {
      config.out += ",";
    } else {
      config.out += jcomp.newLine(config);
    }
  },

  /**
   * Generate the start of the an object in the output stream and push in the new path
   */
  startObject: function (config) {
    config.indent++;
    config.out += "{";

    if (config.paths.length === 0) {
      /*
       * Then we are at the top of the object and we want to add
       * a path for it.
       */
      config.paths.push({
        path: jcomp.generatePath(config),
        line: config.line,
      });
    }

    if (config.indent === 0) {
      config.indent++;
    }
  },

  /**
   * Finish the object, outdent, and pop off all the path
   */
  finishObject: function (config) {
    if (config.indent === 0) {
      config.indent--;
    }

    jcomp.removeTrailingComma(config);

    config.indent--;
    config.out += jcomp.newLine(config) + jcomp.getTabs(config.indent) + "}";
    if (config.indent !== 0) {
      config.out += ",";
    } else {
      config.out += jcomp.newLine(config);
    }
  },

  /**
   * Format a specific value into the output stream.
   */
  formatVal: function (val, config) {
    if (getType(val) === "array") {
      config.out += "[";

      config.indent++;
      val.forEach(function (arrayVal, index) {
        config.out += jcomp.newLine(config) + jcomp.getTabs(config.indent);
        config.paths.push({
          path: jcomp.generatePath(config, "[" + index + "]"),
          line: config.line,
        });

        config.currentPath.push("/[" + index + "]");
        jcomp.formatVal(arrayVal, config);
        config.currentPath.pop();
      });
      jcomp.removeTrailingComma(config);
      config.indent--;

      config.out +=
        jcomp.newLine(config) + jcomp.getTabs(config.indent) + "]" + ",";
    } else if (getType(val) === "object") {
      jcomp.formatAndDecorate(config, val);
    } else if (getType(val) === "string") {
      config.out += '"' + jcomp.unescapeString(val) + '",';
    } else if (getType(val) === "number") {
      config.out += val + ",";
    } else if (getType(val) === "boolean") {
      config.out += val + ",";
    } else if (getType(val) === "null") {
      config.out += "null,";
    }
  },

  /**
   * When we parse the JSON string we end up removing the escape strings when we parse it
   * into objects.  This results in invalid JSON if we insert those strings back into the
   * generated JSON.  We also need to look out for characters that change the line count
   * like new lines and carriage returns.
   *
   * This function puts those escaped values back when we generate the JSON output for the
   * well known escape strings in JSON.  It handles properties and values.
   *
   * This function does not handle unicode escapes.  Unicode escapes are optional in JSON
   * and the JSON output is still valid with a unicode character in it.
   */
  unescapeString: function (val) {
    if (val) {
      return val
        .replace("\\", "\\\\") // Single slashes need to be replaced first
        .replace(/\"/g, '\\"') // Then double quotes
        .replace(/\n/g, "\\n") // New lines
        .replace("\b", "\\b") // Backspace
        .replace(/\f/g, "\\f") // Formfeed
        .replace(/\r/g, "\\r") // Carriage return
        .replace(/\t/g, "\\t"); // Horizontal tabs
    } else {
      return val;
    }
  },

  /**
   * Generate a JSON path based on the specific configuration and an optional property.
   */
  generatePath: function (config, prop) {
    var s = "";
    config.currentPath.forEach(function (path) {
      s += path;
    });

    if (prop) {
      s += "/" + prop;
    }

    if (s.length === 0) {
      return "/";
    } else {
      return s;
    }
  },

  /**
   * Add a new line to the output stream
   */
  newLine: function (config) {
    config.line++;
    return "\n";
  },

  /**
   * Sort all the relevant properties and return them in an alphabetical sort by property key
   */
  getSortedProperties: function (/*Object*/ obj) {
    var props = [];

    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        props.push(prop);
      }
    }

    props = props.sort(function (a, b) {
      return a.localeCompare(b);
    });

    return props;
  },

  /**
   * Generate the diff and verify that it matches a JSON path
   */
  generateDiff: function (
    config1,
    path1,
    config2,
    path2,
    /*String*/ msg,
    type
  ) {
    if (path1 !== "/" && path1.charAt(path1.length - 1) === "/") {
      path1 = path1.substring(0, path1.length - 1);
    }

    if (path2 !== "/" && path2.charAt(path2.length - 1) === "/") {
      path2 = path2.substring(0, path2.length - 1);
    }
    var pathObj1 = config1.paths.find(function (path) {
      return path.path === path1;
    });
    var pathObj2 = config2.paths.find(function (path) {
      return path.path === path2;
    });

    if (!pathObj1) {
      throw "Unable to find line number for (" + msg + "): " + path1;
    }

    if (!pathObj2) {
      throw "Unable to find line number for (" + msg + "): " + path2;
    }

    return {
      path1: pathObj1,
      path2: pathObj2,
      type: type,
      msg: msg,
    };
  },

  /**
   * Get the current indent level
   */
  getTabs: function (/*int*/ indent) {
    var s = "";
    for (var i = 0; i < indent; i++) {
      s += "    ";
    }

    return s;
  },

  /**
   * Remove the trailing comma from the output.
   */
  removeTrailingComma: function (config) {
    /*
     * Remove the trailing comma
     */
    if (config.out.charAt(config.out.length - 1) === ",") {
      config.out = config.out.substring(0, config.out.length - 1);
    }
  },

  /**
   * Create a config object for holding differences
   */
  createConfig: function () {
    return {
      out: "",
      indent: -1,
      currentPath: [],
      paths: [],
      line: 1,
    };
  },

  /**
   * Format the output pre tags.
   */
  formatPRETags: function () {
    forEach($("pre"), function (pre) {
      var codeBlock = $('<pre class="codeBlock"></pre>');
      var lineNumbers = $('<div class="gutter"></div>');
      codeBlock.append(lineNumbers);

      var codeLines = $("<div></div>");
      codeBlock.append(codeLines);

      var addLine = function (line, index) {
        var div = $('<div class="codeLine line' + (index + 1) + '"></div>');
        lineNumbers.append(
          $('<span class="line-number">' + (index + 1) + ".</span>")
        );

        var span = $('<span class="code"></span');
        span.text(line);
        div.append(span);

        codeLines.append(div);
      };

      var lines = $(pre).text().split("\n");
      lines.forEach(addLine);

      codeBlock.addClass($(pre).attr("class"));
      codeBlock.attr("id", $(pre).attr("id"));

      $(pre).replaceWith(codeBlock);
    });
  },

  /**
   * Format the text edits which handle the JSON input
   */
  formatTextAreas: function () {
    forEach($("textarea"), function (textarea) {
      var codeBlock = $('<div class="codeBlock"></div>');
      var lineNumbers = $('<div class="gutter"></div>');
      codeBlock.append(lineNumbers);

      var addLine = function (line, index) {
        lineNumbers.append(
          $('<span class="line-number">' + (index + 1) + ".</span>")
        );
      };

      var lines = $(textarea).val().split("\n");
      lines.forEach(addLine);

      $(textarea).replaceWith(codeBlock);
      codeBlock.append(textarea);
    });
  },

  handleDiffClick: function (line, side) {
    var diffs = jcomp.diffs.filter(function (diff) {
      if (side === jcomp.LEFT) {
        return line === diff.path1.line;
      } else if (side === jcomp.RIGHT) {
        return line === diff.path2.line;
      } else {
        return line === diff.path1.line || line === diff.path2.line;
      }
    });

    $("pre.left span.code").removeClass("selected");
    $("pre.right span.code").removeClass("selected");
    $("ul.toolbar").text("");
    diffs.forEach(function (diff) {
      $("pre.left div.line" + diff.path1.line + " span.code").addClass(
        "selected"
      );
    });

    if (side === jcomp.LEFT || side === jcomp.RIGHT) {
      jcomp.currentDiff = jcomp.diffs.findIndex(function (diff) {
        return diff.path1.line === line;
      });
    }

    if (jcomp.currentDiff === -1) {
      jcomp.currentDiff = jcomp.diffs.findIndex(function (diff) {
        return diff.path2.line === line;
      });
    }

    var buttons = $('<div id="buttons"><div>');
    var prev = $(
      '<a href="#" title="Previous difference" id="prevButton">&lt;</a>'
    );
    prev.addClass("disabled");
    prev.click(function (e) {
      e.preventDefault();
      jcomp.highlightPrevDiff();
    });
    buttons.append(prev);

    buttons.append('<span id="prevNextLabel"></span>');

    var next = $(
      '<a href="#" title="Next difference" id="nextButton">&gt;</a>'
    );
    next.click(function (e) {
      e.preventDefault();
      jcomp.highlightNextDiff();
    });
    buttons.append(next);

    $("ul.toolbar").append(buttons);
    jcomp.updateButtonStyles();

    jcomp.showDiffDetails(diffs);
  },

  highlightPrevDiff: function () {
    if (jcomp.currentDiff > 0) {
      jcomp.currentDiff--;
      jcomp.highlightDiff(jcomp.currentDiff);
      jcomp.scrollToDiff(jcomp.diffs[jcomp.currentDiff]);

      jcomp.updateButtonStyles();
    }
  },

  highlightNextDiff: function () {
    if (jcomp.currentDiff < jcomp.diffs.length - 1) {
      jcomp.currentDiff++;
      jcomp.highlightDiff(jcomp.currentDiff);
      jcomp.scrollToDiff(jcomp.diffs[jcomp.currentDiff]);

      jcomp.updateButtonStyles();
    }
  },

  updateButtonStyles: function () {
    $("#prevButton").removeClass("disabled");
    $("#nextButton").removeClass("disabled");

    $("#prevNextLabel").text(
      jcomp.currentDiff + 1 + " of " + jcomp.diffs.length
    );

    if (jcomp.currentDiff === 1) {
      $("#prevButton").addClass("disabled");
    } else if (jcomp.currentDiff === jcomp.diffs.length - 1) {
      $("#nextButton").addClass("disabled");
    }
  },

  /**
   * Highlight the diff at the specified index
   */
  highlightDiff: function (index) {
    jcomp.handleDiffClick(jcomp.diffs[index].path1.line, jcomp.BOTH);
  },

  /**
   * Show the details of the specified diff
   */
  showDiffDetails: function (diffs) {
    diffs.forEach(function (diff) {
      var li = $("<li></li>");
      li.html(diff.msg);
      $("ul.toolbar").append(li);

      li.click(function () {
        jcomp.scrollToDiff(diff);
      });
    });
  },

  /**
   * Scroll the specified diff to be visible
   */
  scrollToDiff: function (diff) {
    $("html, body").animate(
      {
        scrollTop: $(
          "pre.left div.line" + diff.path1.line + " span.code"
        ).offset().top,
      },
      0
    );
  },

  /**
   * Process the specified diff
   */
  processDiffs: function () {
    var left = [];
    var right = [];
    jcomp.diffs.forEach(function (diff) {
      $("pre.left div.line" + diff.path1.line + " span.code")
        .addClass(diff.type)
        .addClass("diff");
      if (left.indexOf(diff.path1.line) === -1) {
        $("pre.left div.line" + diff.path1.line + " span.code").click(
          function () {
            jcomp.handleDiffClick(diff.path1.line, jcomp.LEFT);
          }
        );
        left.push(diff.path1.line);
      }

      $("pre.right div.line" + diff.path2.line + " span.code")
        .addClass(diff.type)
        .addClass("diff");
      if (right.indexOf(diff.path2.line) === -1) {
        $("pre.right div.line" + diff.path2.line + " span.code").click(
          function () {
            jcomp.handleDiffClick(diff.path2.line, jcomp.RIGHT);
          }
        );
        right.push(diff.path2.line);
      }
    });

    jcomp.diffs = jcomp.diffs.sort(function (a, b) {
      return a.path1.line - b.path1.line;
    });
  },

  /**
   * Validate the input against the JSON parser
   */
  validateInput: function (json, side) {
    try {
      jsl.parser.parse(json);

      if (side === jcomp.LEFT) {
        $("#errorLeft").text("").hide();
        $("#textarealeft").removeClass("error");
      } else {
        $("#errorRight").text("").hide();
        $("#textarearight").removeClass("error");
      }

      return true;
    } catch (parseException) {
      if (side === jcomp.LEFT) {
        $("#errorLeft").text(parseException.message).show();
        $("#textarealeft").addClass("error");
      } else {
        $("#errorRight").text(parseException.message).show();
        $("#textarearight").addClass("error");
      }
      return false;
    }
  },

  /**
   * Handle the file uploads
   */
  handleFiles: function (files, side) {
    var reader = new FileReader();

    reader.onload = (function () {
      return function (e) {
        if (side === jcomp.LEFT) {
          $("#textarealeft").val(e.target.result);
        } else {
          $("#textarearight").val(e.target.result);
        }
      };
    })(files[0]);

    reader.readAsText(files[0]);
  },

  /**
   * Generate the report section with the diff
   */
  generateReport: function () {
    var report = $("#report");

    report.text("");

    var newDiff = $("<button>Perform a new comparison</button>");
    report.append(newDiff);
    newDiff.click(function () {
      location.reload();
      return false;
    });

    if (jcomp.diffs.length === 0) {
      report.append("<span>The two files were semantically identical.</span>");
      return;
    }

    var typeCount = 0;
    var eqCount = 0;
    var missingCount = 0;
    jcomp.diffs.forEach(function (diff) {
      if (diff.type === jcomp.EQUALITY) {
        eqCount++;
      } else if (diff.type === jcomp.MISSING) {
        missingCount++;
      } else if (diff.type === jcomp.TYPE) {
        typeCount++;
      }
    });

    var title = $('<div class="reportTitle"></div>');
    if (jcomp.diffs.length === 1) {
      title.text("Found " + jcomp.diffs.length + " difference");
    } else {
      title.text("Found " + jcomp.diffs.length + " differences");
    }

    report.prepend(title);

    var filterBlock = $('<span class="filterBlock">Show:</span>');

    /*
     * The missing checkbox
     */
    if (missingCount > 0) {
      var missing = $(
        '<label><input id="showMissing" type="checkbox" name="checkbox" value="value" checked="true"></label>'
      );
      if (missingCount === 1) {
        missing.append(missingCount + " missing property");
      } else {
        missing.append(missingCount + " missing properties");
      }
      missing.children("input").click(function () {
        if (!$(this).prop("checked")) {
          $("span.code.diff.missing")
            .addClass("missing_off")
            .removeClass("missing");
        } else {
          $("span.code.diff.missing_off")
            .addClass("missing")
            .removeClass("missing_off");
        }
      });
      filterBlock.append(missing);
    }

    /*
     * The types checkbox
     */
    if (typeCount > 0) {
      var types = $(
        '<label><input id="showTypes" type="checkbox" name="checkbox" value="value" checked="true"></label>'
      );
      if (typeCount === 1) {
        types.append(typeCount + " incorrect type");
      } else {
        types.append(typeCount + " incorrect types");
      }

      types.children("input").click(function () {
        if (!$(this).prop("checked")) {
          $("span.code.diff.type").addClass("type_off").removeClass("type");
        } else {
          $("span.code.diff.type_off").addClass("type").removeClass("type_off");
        }
      });
      filterBlock.append(types);
    }

    /*
     * The equals checkbox
     */
    if (eqCount > 0) {
      var eq = $(
        '<label><input id="showEq" type="checkbox" name="checkbox" value="value" checked="true"></label>'
      );
      if (eqCount === 1) {
        eq.append(eqCount + " unequal value");
      } else {
        eq.append(eqCount + " unequal values");
      }
      eq.children("input").click(function () {
        if (!$(this).prop("checked")) {
          $("span.code.diff.eq").addClass("eq_off").removeClass("eq");
        } else {
          $("span.code.diff.eq_off").addClass("eq").removeClass("eq_off");
        }
      });
      filterBlock.append(eq);
    }

    report.append(filterBlock);
  },

  /**
   * Implement the compare button and complete the compare process
   */
  compare: function () {
    if (jcomp.requestCount !== 0) {
      /*
       * This means we have a pending request and we just need to wait for that to finish.
       */
      return;
    }

    $("body").addClass("progress");
    $("#compare").prop("disabled", true);

    /*
     * We'll start by running the text through JSONlint since it gives
     * much better error messages.
     */
    var leftValid = jcomp.validateInput($("#textarealeft").val(), jcomp.LEFT);
    var rightValid = jcomp.validateInput(
      $("#textarearight").val(),
      jcomp.RIGHT
    );

    if (!leftValid || !rightValid) {
      $("body").removeClass("progress");
      $("#compare").prop("disabled", false);
      return;
    }

    $("div.initContainer").hide();
    $("div.diffcontainer").show();

    jcomp.diffs = [];

    var left = JSON.parse($("#textarealeft").val());
    var right = JSON.parse($("#textarearight").val());

    var config = jcomp.createConfig();
    jcomp.formatAndDecorate(config, left);
    $("#out").text(config.out);

    var config2 = jcomp.createConfig();
    jcomp.formatAndDecorate(config2, right);
    $("#out2").text(config2.out);

    jcomp.formatPRETags();

    config.currentPath = [];
    config2.currentPath = [];

    jcomp.diffVal(left, config, right, config2);
    jcomp.processDiffs();
    jcomp.generateReport();

    if (jcomp.diffs.length > 0) {
      jcomp.highlightDiff(0);
      jcomp.currentDiff = 0;
      jcomp.updateButtonStyles();
    }

    $("body").removeClass("progress");
    $("#compare").prop("disabled", false);

    /*
     * We want to switch the toolbar bar between fixed and absolute position when you
     * scroll so you can get the maximum number of toolbar items.
     */
    var toolbarTop = $("#toolbar").offset().top - 15;
    $(window).scroll(function () {
      if (toolbarTop < $(window).scrollTop()) {
        $("#toolbar").css("position", "fixed").css("top", "10px");
      } else {
        $("#toolbar").css("position", "absolute").css("top", "");
      }
    });
  },

  getParameterByName: function (name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
    return results === null
      ? ""
      : decodeURIComponent(results[1].replace(/\+/g, " "));
  },
};

jQuery(document).ready(function () {
  $("#compare").click(function () {
    jcomp.compare();
  });

  if (jcomp.getParameterByName("left")) {
    $("#textarealeft").val(jcomp.getParameterByName("left"));
  }

  if (jcomp.getParameterByName("right")) {
    $("#textarearight").val(jcomp.getParameterByName("right"));
  }

  if (jcomp.getParameterByName("left") && jcomp.getParameterByName("right")) {
    jcomp.compare();
  }

  $(document).keydown(function (event) {
    if (event.keyCode === 78 || event.keyCode === 39) {
      /*
       * The N key or right arrow key
       */
      jcomp.highlightNextDiff();
    } else if (event.keyCode === 80 || event.keyCode === 37) {
      /*
       * The P key or left arrow key
       */
      jcomp.highlightPrevDiff();
    }
  });
});

// Array.prototype.find
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, "find", {
    value: function (predicate) {
      if (this === null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      var len = o.length >>> 0;

      if (typeof predicate !== "function") {
        throw new TypeError("predicate must be a function");
      }

      var thisArg = arguments[1];

      var k = 0;

      while (k < len) {
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return kValue;
        }

        k++;
      }

      return undefined;
    },
    configurable: true,
    writable: true,
  });
}

// Array.prototype.findIndex
if (!Array.prototype.findIndex) {
  Object.defineProperty(Array.prototype, "findIndex", {
    value: function (predicate) {
      if (this === null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      var len = o.length >>> 0;

      if (typeof predicate !== "function") {
        throw new TypeError("predicate must be a function");
      }

      var thisArg = arguments[1];
      var k = 0;

      while (k < len) {
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return k;
        }

        k++;
      }

      return -1;
    },
    configurable: true,
    writable: true,
  });
}
